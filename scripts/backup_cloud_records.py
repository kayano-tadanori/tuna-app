# -*- coding: utf-8 -*-
"""
オトン学園のクラウド記録を、まるごとこのPCに吸い出して日付ごとに残す。

2026-08-04、ほまれ（次男の友達）の記録が空データで2回上書きされ、
Firestoreの過去時点読み取りが1時間しか遡れないせいで3%ぶんを失った。
「消えたことに数時間後に気づいても戻せる」ようにするための世代バックアップ。

  python backup_cloud_records.py

出力先: Desktop\\Claude\\オトン学園バックアップ\\YYYY-MM-DD\\{受験番号}.json
（Desktop\\Claude は Google ドライブへ自動ミラーされるので、PCが壊れても残る）

読み取りだけ。クラウドには一切書き込まない。
"""
import json
import os
import sys
import datetime
import urllib.parse
import urllib.request

# firebase.js の FIREBASE_CONFIG と同じ値。読み取りはセキュリティルールで公開されている
API_KEY = "AIzaSyCEWbHfGMcSQpELPGNdVgLiXZ_mmYTqsPg"
PROJECT = "tuna-app-4eeab"
ROOT = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"

OUT_BASE = os.environ.get("OTON_BACKUP_DIR") or \
    os.path.join(os.path.expanduser("~"), "Desktop", "Claude", "オトン学園バックアップ")


def get_json(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def field_values(doc):
    """Firestoreの型つきフィールドを素のdictに開く"""
    out = {}
    for k, v in (doc.get("fields") or {}).items():
        for t in ("stringValue", "integerValue", "doubleValue", "booleanValue", "timestampValue"):
            if t in v:
                out[k] = v[t]
                break
    return out


def list_nicknames():
    """achievement コレクションから受験番号の一覧を取る"""
    names, token = [], None
    while True:
        url = f"{ROOT}/achievement?key={API_KEY}&pageSize=300"
        if token:
            url += f"&pageToken={token}"
        d = get_json(url)
        for doc in d.get("documents", []):
            names.append(doc["name"].rsplit("/", 1)[-1])
        token = d.get("nextPageToken")
        if not token:
            break
    return names


def count_progress(record):
    try:
        return len(json.loads((record.get("backup") or {}).get("progress") or "{}"))
    except Exception:
        return -1


def find_previous(safe_name, today_dir):
    """今日より前のフォルダから、いちばん新しい保存を探す"""
    if not os.path.isdir(OUT_BASE):
        return None, None
    for day in sorted(os.listdir(OUT_BASE), reverse=True):
        d = os.path.join(OUT_BASE, day)
        if d == today_dir or not os.path.isdir(d):
            continue
        p = os.path.join(d, safe_name + ".json")
        if os.path.exists(p):
            try:
                with open(p, encoding="utf-8") as f:
                    return json.load(f), day
            except Exception:
                return None, None
    return None, None


def main():
    day = datetime.date.today().isoformat()
    out_dir = os.path.join(OUT_BASE, day)
    os.makedirs(out_dir, exist_ok=True)

    try:
        nicknames = list_nicknames()
    except Exception as e:
        print("受験番号の一覧が取れませんでした:", e)
        return 1

    ok = skipped = 0
    summary, alerts = [], []
    for nick in nicknames:
        enc = urllib.parse.quote(nick, safe="")
        record = {"nickname": nick, "fetchedAt": datetime.datetime.now().isoformat(timespec="seconds")}
        try:
            record["backup"] = field_values(get_json(f"{ROOT}/users/{enc}/backup/data?key={API_KEY}"))
        except Exception as e:
            record["backup"] = None
            record["backupError"] = str(e)
        try:
            record["achievement"] = field_values(get_json(f"{ROOT}/achievement/{enc}?key={API_KEY}"))
        except Exception as e:
            record["achievement"] = None

        if not record["backup"]:
            skipped += 1
        else:
            ok += 1

        # ファイル名に使えない文字を避ける（受験番号は自由入力なので ☆ や ＊ が入る）
        safe = "".join(c if c not in '\\/:*?"<>|' else "_" for c in nick)
        n = count_progress(record)

        # ★記録が減っていたら事故のサイン。減る前の状態を今日のフォルダにも複製しておく
        #   （日付フォルダは1日1件なので、当日中に壊れると当日ぶんが壊れた値で埋まるため）
        prev, prev_day = find_previous(safe, out_dir)
        note = ""
        if prev is not None:
            pn = count_progress(prev)
            if pn > 0 and n >= 0 and n < pn:
                note = f"  ⚠ {pn}問 → {n}問 に減っています"
                with open(os.path.join(out_dir, f"{safe}_減る前_{prev_day}.json"), "w", encoding="utf-8") as f:
                    json.dump(prev, f, ensure_ascii=False, indent=1)
                alerts.append(f"  ⚠ {nick}: {prev_day}は{pn}問 → 今日は{n}問（減る前を退避しました）")

        with open(os.path.join(out_dir, safe + ".json"), "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=1)

        summary.append(f"  {nick}: {n}問{note}")

    print(f"{day}: {ok}件を保存 / {skipped}件はバックアップ無し")
    print("\n".join(summary))
    print("→", out_dir)
    if alerts:
        print("\n===== 記録が減っています =====")
        print("\n".join(alerts))
    return 0


if __name__ == "__main__":
    sys.exit(main())
