# -*- coding: utf-8 -*-
"""第1分冊の大問を、JSONに書きこまずに組み立てて中身を見るための下見スクリプト。"""
import io, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g4b1_add_daimon import build_specs

built, unresolved = build_specs()
out = [dict(hg=hg, no=no, kind=sp.get("kind", ""), title=sp["title"], star=sp["star"],
            unit=sp["unit"], category=sp["category"], intro=sp.get("intro", ""),
            svg=("あり" if sp.get("svg") else ""), steps=sp["steps"]) for hg, no, sp in built]
dst = sys.argv[1] if len(sys.argv) > 1 else "g4b1_preview.json"
io.open(dst, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
sys.stderr.write("%d records / %d steps / unresolved %d -> %s\n"
                 % (len(out), sum(len(o["steps"]) for o in out), len(unresolved), dst))
