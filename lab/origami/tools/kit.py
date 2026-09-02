"""検査キットの共通部品。

★何のためか（本人 2026-09-03「いまからたくさん折り紙を追加していくから
  検査キット組んどけば」）
   作品を1つ足すたびに、検査スクリプトを何本も手で書き直さなくていいようにする。
   **作品の名簿は works_build.BUILDERS ただ1か所**。そこに足せば、全部の検査が
   自動でその作品を見る。検査ごとに名前を並べる書き方は、足し忘れた作品が
   黙って検査を素通りする（実際 check_axis_safety だけ「おうち」が抜けていた）。

★使い方
   from kit import target_works
   WORKS = target_works()        # 引数なし＝全作品／`python check_xx.py koppu`＝1つだけ
"""
import sys


def target_works(argv=None):
    """検査する作品の一覧を返す。コマンドラインで作品名を書けばその作品だけ。"""
    import works_build as W
    src = sys.argv[1:] if argv is None else argv
    names = [a for a in src if not a.startswith('-')]
    bad = [n for n in names if n not in W.BUILDERS]
    if bad:
        raise SystemExit(f'そんな作品はない: {bad}\n'
                         f'ある作品: {", ".join(W.BUILDERS)}')
    return names or list(W.BUILDERS)
