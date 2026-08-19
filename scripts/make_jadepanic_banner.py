# ゲーム本編の画面から カード用のバナー画像を作る
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright
DST = r"c:/Users/User/Desktop/Claude/tuna app/images/jadepanic-banner.png"
URL = "http://localhost:8901/lab/jadepanic/index.html"
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    # バナーは横長。1080x300 くらいで撮って カードの背景に敷く
    pg = b.new_page(viewport={"width":1080,"height":420}, device_scale_factor=1)
    pg.goto(URL)
    pg.evaluate("() => localStorage.setItem('jp_seen_story','1')")
    pg.reload(); pg.wait_for_timeout(2000)
    # UIを隠して 絵だけにする（ジェイドが飛び、グリッドが光っている画）
    pg.evaluate("""() => {
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('hud').classList.add('hidden');
      Game.state = 'title';
    }""")
    # バグを何体か出して にぎやかにする
    pg.evaluate("""() => {
      Game.state = 'play'; G.phase = 'play';
      G.reset('survival','normal', Game.field.w, Game.field.h);
      G.enemies.length = 0; G.spawns.length = 0; Part.clear();
      const put=(t,x,y)=>{const e=G.spawnEnemy(t,x,y,0); e.born=0.01; e.vx=0; e.vy=0; return e;};
      const clump=(t,cx,cy,n,rad)=>{for(let i=0;i<n;i++){const a=Math.random()*6.28,r=Math.sqrt(Math.random())*rad; put(t,cx+Math.cos(a)*r,cy+Math.sin(a)*r);}};
      clump('noise',-560,110,7,120); clump('chaser',260,-120,6,110); clump('spinner',430,140,5,110);
      put('split',150,190); put('dodger',-260,-150); put('dodger',-190,-70);
      const h=put('hole',600,20); h.grow=8;
      for(let i=0;i<26;i++) G.bits.push({x:(Math.random()-0.5)*1150,y:(Math.random()-0.5)*450,vx:0,vy:0,life:11,rot:Math.random()*6,spin:1,pull:0});
      G.p.x=60; G.p.y=10; G.p.face=-0.35; G.p.aim=-0.35; G.p.thrust=1; G.invul=999; G.p.flap=1.2;
      for(let i=0;i<4;i++) G.fire(-0.35);
      Part.burst(430,140,55,[1,0.36,0.88],820,3.6,1.2,2.1,0.85);
      Part.burst(-560,110,30,[0.69,0.42,1],620,3.2,0.9,2.0,0.9);
      document.getElementById('touch-ui').classList.add('hidden');
      Game.msgTimer = 0;
    }""")
    pg.wait_for_timeout(500)
    pg.screenshot(path=DST, clip={"x":0,"y":60,"width":1080,"height":300})
    print("バナー保存:", DST)
    b.close()
