// ============================================================
// scratchpad.js — 灘中対策コーナー用の計算用紙(全画面・画面の4倍の広さ・
//   2本指でパン＆ピンチズーム)。
//   本体オトン学園(js/sansu.js の createDrawPad/openScratchFullscreen)と
//   同じ仕組みを、このアプリの流儀(ori-プレフィックス・ダークテーマ)に
//   合わせて移植したもの(コードは共有せず、このlabフォルダ内で完結させる、
//   [[project_3d_atelier]]等の既存の流儀と同じ)。
// ============================================================
'use strict';

const OrigamiScratch = (function () {
  const MIN_ZOOM = 0.25, MAX_ZOOM = 3;
  let pad = null, view = null;
  let overlay, viewport, canvas;

  function createDrawPad(canvas, opts) {
    opts = opts || {};
    const grid = !!opts.grid;
    const penColor = opts.penColor || '#1a1a1a';
    const lineWidth = opts.lineWidth || 5;
    const p = { canvas, ctx: canvas.getContext('2d'), strokes: [], current: [], drawing: false, suppressed: false };

    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    };
    canvas.onpointerdown = e => {
      if (p.suppressed) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      p.drawing = true;
      p.current = [pos(e)];
      draw();
    };
    canvas.onpointermove = e => { if (!p.drawing) return; p.current.push(pos(e)); draw(); };
    const up = () => {
      if (!p.drawing) return;
      p.drawing = false;
      if (p.current.length > 1) p.strokes.push(p.current);
      p.current = [];
      draw();
    };
    canvas.onpointerup = up;
    canvas.onpointercancel = up;
    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    function draw() {
      const { ctx } = p;
      if (grid) {
        ctx.fillStyle = '#f8f6ef';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(120,120,120,0.18)';
        ctx.lineWidth = 1;
        const step = 24;
        for (let x = step; x < canvas.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = step; y < canvas.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
        const bw = Math.max(4, Math.round(canvas.width / 100));
        ctx.strokeStyle = '#4f9eff';
        ctx.lineWidth = bw;
        ctx.strokeRect(bw / 2, bw / 2, canvas.width - bw, canvas.height - bw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ctx.strokeStyle = penColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const paint = pts => {
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      };
      p.strokes.forEach(paint);
      paint(p.current);
    }
    p.clear = () => { p.strokes = []; p.current = []; draw(); };
    p.undo = () => { p.strokes.pop(); draw(); };
    p.cancelCurrent = () => { p.drawing = false; p.current = []; draw(); };
    draw();
    return p;
  }

  function applyTransform() {
    canvas.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
  }

  function clampView() {
    view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
    const dispW = view.virtualW * view.zoom, dispH = view.virtualH * view.zoom;
    const marginX = Math.max(dispW, view.vw) * 0.5;
    const marginY = Math.max(dispH, view.vh) * 0.5;
    view.panX = Math.min(marginX, Math.max(view.vw - dispW - marginX, view.panX));
    view.panY = Math.min(marginY, Math.max(view.vh - dispH - marginY, view.panY));
  }

  function fitToScreen() {
    const curVw = viewport.clientWidth || view.vw;
    const curVh = viewport.clientHeight || view.vh;
    const fitZoom = Math.min(curVw / view.virtualW, curVh / view.virtualH, 1);
    view.zoom = Math.max(MIN_ZOOM, fitZoom);
    view.panX = (curVw - view.virtualW * view.zoom) / 2;
    view.panY = (curVh - view.virtualH * view.zoom) / 2;
    applyTransform();
  }

  function setupGestures() {
    const pointers = new Map();
    let gestureActive = false, prevMid = null, prevDist = null;
    const viewportPos = e => {
      const r = viewport.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const midOf = pts => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
    const distOf = pts => Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

    viewport.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, viewportPos(e));
      if (pointers.size === 2) {
        gestureActive = true;
        pad.suppressed = true;
        pad.cancelCurrent();
        const pts = [...pointers.values()];
        prevMid = midOf(pts);
        prevDist = distOf(pts);
      }
    }, { capture: true });

    viewport.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, viewportPos(e));
      if (!gestureActive || pointers.size !== 2) return;
      e.preventDefault();
      const pts = [...pointers.values()];
      const mid = midOf(pts);
      const dist = distOf(pts);
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * (dist / prevDist)));
      view.panX = mid.x - (newZoom / view.zoom) * (prevMid.x - view.panX);
      view.panY = mid.y - (newZoom / view.zoom) * (prevMid.y - view.panY);
      view.zoom = newZoom;
      applyTransform();
      prevMid = mid;
      prevDist = dist;
    }, { capture: true });

    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0 && gestureActive) {
        gestureActive = false;
        prevMid = null; prevDist = null;
        clampView();
        applyTransform();
        pad.suppressed = false;
      }
    };
    viewport.addEventListener('pointerup', endPointer, { capture: true });
    viewport.addEventListener('pointercancel', endPointer, { capture: true });
  }

  function ensure() {
    if (pad) return;
    overlay = document.getElementById('ori-scratch-fullscreen');
    viewport = document.getElementById('ori-scratch-viewport');
    canvas = document.getElementById('ori-scratch-canvas');

    const dpr = window.devicePixelRatio || 1;
    const vw = viewport.clientWidth || window.innerWidth;
    const vh = viewport.clientHeight || window.innerHeight;
    const virtualW = vw * 2, virtualH = vh * 2; // 画面の縦横2倍=面積4倍
    canvas.style.width = virtualW + 'px';
    canvas.style.height = virtualH + 'px';
    // 巨大canvasが確保できない古い端末向けに実ピクセル数の上限を設ける
    const MAX_CANVAS_PIXELS = 4000000;
    const rawPixels = virtualW * dpr * virtualH * dpr;
    const effDpr = rawPixels > MAX_CANVAS_PIXELS ? dpr * Math.sqrt(MAX_CANVAS_PIXELS / rawPixels) : dpr;
    canvas.width = Math.round(virtualW * effDpr);
    canvas.height = Math.round(virtualH * effDpr);

    pad = createDrawPad(canvas, { grid: true, penColor: '#ffd166', lineWidth: 4 * effDpr });
    view = { virtualW, virtualH, vw, vh, panX: -(virtualW - vw) / 2, panY: -(virtualH - vh) / 2, zoom: 1 };
    applyTransform();

    document.getElementById('ori-scratch-undo').onclick = () => pad.undo();
    document.getElementById('ori-scratch-clear').onclick = () => pad.clear();
    document.getElementById('ori-scratch-close').onclick = () => close();
    document.getElementById('ori-scratch-fit').onclick = fitToScreen;
    setupGestures();
  }

  function open() {
    ensure();
    overlay.hidden = false;
  }
  function close() {
    if (overlay) overlay.hidden = true;
  }
  // 問題を切り替えるときに呼ぶ(前の問題の書き込みを持ち越さない)
  function reset() {
    if (pad) pad.clear();
  }

  return { open, close, reset };
})();

if (typeof window !== 'undefined') window.OrigamiScratch = OrigamiScratch;
