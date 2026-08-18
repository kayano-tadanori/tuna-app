import fitz, glob, os

base = r"C:\Users\User\Desktop\浜問題\公開学力テスト"
targets = [
    "2020年度 4年 公開テスト算数.pdf",
    "2021年度 4年 公開テスト算数.pdf",
    "2022年度 4年 公開テスト算数.pdf",
    "2023年度 4年公開テスト算数.pdf",
    "漏れ　2020年度 公開算数5月度.pdf",
]
for name in targets:
    path = os.path.join(base, name)
    d = fitz.open(path)
    print(name, "->", d.page_count, "pages")
