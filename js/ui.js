// Painel de menu flutuante (o mesmo no PC e no VR): desenhado num canvas e mostrado num
// plano 3D. No VR se aponta com o controle; no PC se clica com o mouse.
import * as THREE from '../vendor/three/three.module.js';

const W = 1024, H = 800;
export const UI = {
  bg: 'rgba(8,10,22,0.94)', edge: '#3ef0ff', text: '#e8f4ff', dim: '#8fa3c0',
  btn: '#16203a', btnHover: '#22345e', btnOn: '#3ef0ff', btnOnText: '#06101c', lock: '#11141f',
  pink: '#ff4fd8', gold: '#ffd84a',
};

export class Panel {
  constructor(width = 1.1) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * H / W),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, fog: false }));
    this.mesh.renderOrder = 10;
    this.buttons = [];
    this.hover = -1;
    this.drawFn = null;
  }

  show(drawFn) { this.drawFn = drawFn; this.hover = -1; this.mesh.visible = true; this.redraw(); }
  hide() { this.mesh.visible = false; this.drawFn = null; }
  get visible() { return this.mesh.visible; }

  redraw() {
    const g = this.ctx;
    g.clearRect(0, 0, W, H);
    g.fillStyle = UI.bg; roundRect(g, 4, 4, W - 8, H - 8, 28); g.fill();
    g.strokeStyle = UI.edge; g.lineWidth = 4; g.stroke();
    // faixa de arco-íris no topo
    const grad = g.createLinearGradient(40, 0, W - 40, 0);
    ['#ff3344', '#ffee33', '#33ff66', '#33f0ff', '#3377ff', '#ff33ee'].forEach((c, i, a) => grad.addColorStop(i / (a.length - 1), c));
    g.fillStyle = grad; g.fillRect(40, 14, W - 80, 6);
    this.buttons = [];
    this.drawFn?.(this);
    this.tex.needsUpdate = true;
  }

  title(text, y = 70) {
    const g = this.ctx;
    g.fillStyle = UI.edge; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, y);
  }
  text(text, x, y, { size = 32, color = UI.text, align = 'center', bold = false } = {}) {
    const g = this.ctx;
    g.fillStyle = color; g.font = `${bold ? 'bold ' : ''}${size}px sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(text, x, y);
  }
  button(label, action, x, y, w, h, { on = false, locked = false, size = 34, sub = null } = {}) {
    const g = this.ctx;
    const i = this.buttons.length;
    this.buttons.push({ x, y, w, h, action: locked ? null : action });
    g.fillStyle = locked ? UI.lock : on ? UI.btnOn : (i === this.hover ? UI.btnHover : UI.btn);
    roundRect(g, x, y, w, h, 16); g.fill();
    g.strokeStyle = i === this.hover && !locked ? UI.edge : 'rgba(62,240,255,0.25)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = on ? UI.btnOnText : locked ? UI.dim : UI.text;
    g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x + w / 2, y + h / 2 - (sub ? 14 : 0));
    if (sub) { g.font = '24px sans-serif'; g.fillStyle = on ? UI.btnOnText : UI.dim; g.fillText(sub, x + w / 2, y + h / 2 + 20); }
  }
  // Quadradinho de fase: número, nome, se já venceu e se está liberada.
  tile(x, y, w, h, { num, name, done = false, locked = false, master = false, action }) {
    const g = this.ctx;
    const i = this.buttons.length;
    this.buttons.push({ x, y, w, h, action: locked ? null : action });
    g.fillStyle = locked ? UI.lock : (i === this.hover ? UI.btnHover : UI.btn);
    roundRect(g, x, y, w, h, 14); g.fill();
    g.strokeStyle = i === this.hover && !locked ? UI.text : (!locked && !done ? UI.edge : master ? UI.pink : 'rgba(62,240,255,0.2)');
    g.lineWidth = 3; g.stroke();
    this.text(locked ? '🔒' : String(num), x + w / 2, y + 38, { size: 42, bold: true, color: locked ? UI.dim : master ? UI.pink : UI.edge });
    if (!locked) fitText(g, name, x + w / 2, y + 82, w - 12, 19, UI.text);
    if (done) this.text('✔', x + w - 22, y + 22, { size: 26, bold: true, color: UI.gold });
  }

  pick(uv) {
    if (!uv) return -1;
    const x = uv.x * W, y = (1 - uv.y) * H;
    return this.buttons.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }
  setHover(i) { if (i !== this.hover) { this.hover = i; this.redraw(); } }
  actionAt(i) { return i >= 0 ? this.buttons[i]?.action : null; }
}

function fitText(g, text, x, y, maxW, size, color) {
  let s = size;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  do { g.font = `${s}px sans-serif`; s--; } while (g.measureText(text).width > maxW && s > 11);
  g.fillText(text, x, y);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Placa de texto de uma ou mais linhas (FPS, botão de pausa, letreiro da fase).
export class Label {
  constructor(width = 0.16, px = 256, py = 64) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px; this.canvas.height = py;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * py / px),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, fog: false }));
    this.mesh.renderOrder = 11;
    this.last = null;
  }
  set(text) {
    if (text === this.last) return;
    this.last = text;
    const g = this.ctx, w = this.canvas.width, h = this.canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(6,10,24,0.8)'; roundRect(g, 2, 2, w - 4, h - 4, 12); g.fill();
    g.strokeStyle = UI.edge; g.lineWidth = 3; g.stroke();
    g.fillStyle = UI.edge; g.font = `bold ${Math.round(h * 0.5)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
    this.tex.needsUpdate = true;
  }
  // Várias linhas: [{ text, size, color, bold }]
  setLines(lines) {
    const key = JSON.stringify(lines);
    if (key === this.last) return;
    this.last = key;
    const g = this.ctx, w = this.canvas.width, h = this.canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(6,10,24,0.82)'; roundRect(g, 2, 2, w - 4, h - 4, 18); g.fill();
    g.strokeStyle = 'rgba(62,240,255,0.6)'; g.lineWidth = 3; g.stroke();
    let y = 16;
    for (const l of lines) {
      const size = l.size || 30;
      g.font = `${l.bold ? 'bold ' : ''}${size}px sans-serif`;
      g.fillStyle = l.color || UI.text; g.textAlign = 'center'; g.textBaseline = 'top';
      for (const row of wrap(g, l.text, w - 40)) { g.fillText(row, w / 2, y); y += size * 1.2; }
      y += 6;
    }
    this.tex.needsUpdate = true;
  }
}

function wrap(g, text, maxW) {
  const words = text.split(' '), rows = [];
  let cur = '';
  for (const wd of words) {
    const t = cur ? cur + ' ' + wd : wd;
    if (g.measureText(t).width > maxW && cur) { rows.push(cur); cur = wd; } else cur = t;
  }
  if (cur) rows.push(cur);
  return rows;
}
