# -*- coding: utf-8 -*-
"""自由折り画面（freefold3d.html）を開く入口。「自由折りを開く.bat」から呼ぶ。

★やること
  1. この tools フォルダを配信している自由折りサーバーが 127.0.0.1:8765〜8784 にあれば、それを使う
     （見分け方＝応答ヘッダ X-Freefold-Server と、freefold3d.html の中身がこのフォルダのものと同じか）。
  2. 無ければ、空いている番号で**キャッシュしない**サーバーを起動する（Cache-Control: no-store）。
     ⚠ python -m http.server はキャッシュを止めないので、直した JS が古いまま使われることがある。
     別のフォルダを配信しているサーバー・中身の古いサーバーは使わず、次の番号へ進む。
  3. ブラウザで http://127.0.0.1:<番号>/freefold3d.html を開く。

★file:// で開いても同じように動く（検証器の schema は <script> で読む）。サーバーは JSON 保存や他の道具と同じ開き方をそろえるため。

使い方： python serve_freefold.py            … 開く（サーバーを起動したときは、この窓を閉じると止まる）
         python serve_freefold.py --no-browser … 開かずに番号だけ表示（検査用）
"""
import sys, os, socket, threading, webbrowser, urllib.request, http.server, functools

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGE = 'freefold3d.html'
PORTS = range(8765, 8785)
MARK = 'X-Freefold-Server'


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header(MARK, '1')
        super().end_headers()

    def guess_type(self, path):
        t = super().guess_type(path)
        if path.endswith('.js'):
            return 'text/javascript; charset=utf-8'
        if path.endswith('.html'):
            return 'text/html; charset=utf-8'
        return t

    def log_message(self, fmt, *args):
        pass


def probe(port):
    """'ours'＝このフォルダの自由折りサーバー／'free'＝空き／'other'＝別のもの。"""
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/{PAGE}', timeout=1.5) as r:
            body = r.read()
            same = body == open(os.path.join(ROOT, PAGE), 'rb').read()
            return 'ours' if (r.headers.get(MARK) == '1' and same) else 'other'
    except urllib.error.HTTPError:
        return 'other'
    except Exception:
        with socket.socket() as s:
            s.settimeout(.5)
            return 'other' if s.connect_ex(('127.0.0.1', port)) == 0 else 'free'


def main():
    no_browser = '--no-browser' in sys.argv
    for port in PORTS:
        state = probe(port)
        if state == 'other':
            continue
        url = f'http://127.0.0.1:{port}/{PAGE}'
        if state == 'ours':
            print(f'自由折りサーバーは起動しています：{url}')
            if not no_browser:
                webbrowser.open(url)
            return 0
        handler = functools.partial(NoStore, directory=ROOT)
        try:
            srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
        except OSError:
            continue
        print(f'自由折りサーバーを起動しました：{url}')
        print('この窓を閉じるとサーバーが止まります（file:// で開いても動きます）')
        sys.stdout.flush()
        if not no_browser:
            threading.Timer(.3, lambda: webbrowser.open(url)).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
        return 0
    print('8765〜8784 に空きがありません。freefold3d.html を直接開いてください（file:// でも動きます）')
    if not no_browser:
        webbrowser.open('file:///' + os.path.join(ROOT, PAGE).replace('\\', '/'))
    return 1


if __name__ == '__main__':
    sys.exit(main())
