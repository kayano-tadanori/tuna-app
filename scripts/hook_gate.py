# -*- coding: utf-8 -*-
"""commit の直前に浜学園のゲート（hama.py gate）を走らせるフック。

  ★これを置いた理由：**ルールを覚えて守る形は、コンテキストが埋まると必ず破れる**
    （本人指摘 2026-09-09）。フックは私の状態と無関係に走るので、
    「今日は忘れていた」が起きない。ここが3層のいちばん強い層。

  合図：
    exit 0 … 通す      exit 2 … 止める（stderr の文がそのまま私に返る）
  逃げ道：
    HAMA_SKIP=1 を付けて実行すると素通りする（急ぎのとき用）。
    ★素通りしたことは私が本人に必ず言う。黙って通さない。

  動く条件（これ以外では何もしない）：
    ・Bash/PowerShell で `git commit` を打ったとき
    ・その作業ディレクトリが `tuna app` の中のとき
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        return 0                      # 読めない合図では止めない（安全側）

    cmd = str((ev.get("tool_input") or {}).get("command") or "")
    if "git commit" not in cmd:
        return 0
    cwd = str(ev.get("cwd") or os.getcwd()).replace("\\", "/").lower()
    if "tuna app" not in cwd:
        return 0
    if os.environ.get("HAMA_SKIP"):
        return 0

    p = subprocess.run([sys.executable, os.path.join(HERE, "hama.py"), "gate"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode == 0:
        return 0
    sys.stderr.write((p.stdout or "") + (p.stderr or ""))
    sys.stderr.write(
        "\n上の🚨を直してから commit してください。"
        "\n急ぎで通すときは HAMA_SKIP=1 を付けて実行し、**通したことを本人に必ず伝える**。\n")
    return 2


if __name__ == "__main__":
    sys.exit(main())
