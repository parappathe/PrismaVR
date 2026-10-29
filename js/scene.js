// Cenário: laboratório escuro com luzes neon, a bancada com a grade, as peças, os feixes de
// luz e os cristais. Tudo gerado por código, com poucas luzes e sem sombras (desempenho do Quest).
import * as THREE from '../vendor/three/three.module.js';
import { COLOR_HEX, mergeSegs } from './optics.js';

// Bancada no espaço do "palco" (metros). O jogador fica em x = 0, z = 0, de frente para -z.
export const BENCH = { y: 0.92, z: -0.75, width: 1.3, depth: 0.98 };
export const TRAY_GAP = 0.11;        // distância entre os encaixes da gaveta
export const TRAY_SCALE = 0.085;     // tamanho de uma peça na gaveta
export const BEAM_H = 0.34;          // altura do feixe (fração do tamanho da casa)
export const cellSize = (def) => Math.min(0.11, 0.8 / Math.max(def.w, def.h));

const BG = 0x05060d;

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const neon = (color) => new THREE.MeshBasicMaterial({ color, fog: false });

export const MATS = {
  benchTop: new THREE.MeshLambertMaterial({ color: 0x141722 }),
  benchBody: new THREE.MeshLambertMaterial({ color: 0x0c0e16 }),
  plate: new THREE.MeshLambertMaterial({ color: 0x0b0d18 }),
  base: new THREE.MeshLambertMaterial({ color: 0x1c2030 }),
  metal: new THREE.MeshPhongMaterial({ color: 0x3a4058, shininess: 60, specular: 0x667799 }),
  mirror: new THREE.MeshPhongMaterial({ color: 0xc8d4ec, emissive: 0x1a2238, shininess: 120, specular: 0xffffff }),
  mirrorBack: new THREE.MeshLambertMaterial({ color: 0x2a3044 }),
  splitter: new THREE.MeshPhongMaterial({ color: 0x9ff0ff, emissive: 0x0c3040, transparent: true, opacity: 0.45, shininess: 100, depthWrite: false }),
  frame: new THREE.MeshLambertMaterial({ color: 0x8a96b8 }),
  prism: new THREE.MeshPhongMaterial({ color: 0xe8f0ff, emissive: 0x182030, transparent: true, opacity: 0.6, shininess: 120, depthWrite: false }),
  ringMove: neon(0xffc83a),
  ringTurn: neon(0x3ef0ff),
  arrow: neon(0xffffff),
};

const wallTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#16141c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#5a4a14'; g.lineWidth = 14;
  for (let i = -h; i < w * 2; i += 36) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - h, h); g.stroke(); }
});
MATS.wall = new THREE.MeshLambertMaterial({ map: wallTex });

export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.16);
  scene.add(new THREE.HemisphereLight(0x8a9cff, 0x1a0c22, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(0.6, 3, 1.2);
  scene.add(key);

  const stage = new THREE.Group();
  scene.add(stage);

  // Chão com grade fraquinha
  const floorTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#07080f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1a2050'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }, [24, 24]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  stage.add(floor);

  // Paredes do laboratório: tubos de neon e armários escuros ao fundo
  const tubes = [
    { c: 0xff4fd8, p: [-2.2, 2.3, -3.2], s: [2.6, 0.03, 0.03] },
    { c: 0x3ef0ff, p: [1.9, 1.6, -3.2], s: [2.2, 0.03, 0.03] },
    { c: 0x6a5cff, p: [-3.4, 1.8, -1.0], s: [0.03, 0.03, 3.0] },
    { c: 0x3ef0ff, p: [3.4, 2.4, -1.4], s: [0.03, 0.03, 2.4] },
    { c: 0xffd84a, p: [0.2, 2.9, -3.2], s: [1.2, 0.025, 0.025] },
  ];
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const t of tubes) {
    const m = new THREE.Mesh(box, neon(t.c));
    m.position.set(...t.p); m.scale.set(...t.s);
    stage.add(m);
  }
  const cab = new THREE.MeshLambertMaterial({ color: 0x10121c });
  for (const [x, z, w, h, d] of [[-2.4, -3.0, 1.2, 1.9, 0.5], [2.2, -3.0, 1.6, 1.1, 0.5], [3.1, -1.0, 0.5, 1.4, 1.4], [-3.1, -2.0, 0.5, 1.0, 1.0]]) {
    const m = new THREE.Mesh(box, cab);
    m.position.set(x, h / 2, z); m.scale.set(w, h, d);
    stage.add(m);
    const lamp = new THREE.Mesh(box, neon([0x33ff66, 0xff3344, 0x3377ff, 0xffee33][Math.abs(Math.round(x * 3)) % 4]));
    lamp.position.set(x + w * 0.3, h * 0.8, z + d / 2 + 0.005); lamp.scale.set(0.04, 0.04, 0.01);
    stage.add(lamp);
  }

  // Bancada
  const bench = new THREE.Group();
  stage.add(bench);
  const top = new THREE.Mesh(new THREE.BoxGeometry(BENCH.width, 0.05, BENCH.depth), MATS.benchTop);
  top.position.set(0, BENCH.y - 0.025, BENCH.z + 0.05);
  bench.add(top);
  const body = new THREE.Mesh(new THREE.BoxGeometry(BENCH.width - 0.06, BENCH.y - 0.05, BENCH.depth - 0.1), MATS.benchBody);
  body.position.set(0, (BENCH.y - 0.05) / 2, BENCH.z + 0.05);
  bench.add(body);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(BENCH.width, 0.006, 0.006), neon(0x3ef0ff));
  edge.position.set(0, BENCH.y - 0.004, BENCH.z + 0.05 + BENCH.depth / 2);
  bench.add(edge);
  const edge2 = edge.clone();
  edge2.material = neon(0xff4fd8);
  edge2.position.y = BENCH.y - 0.045;
  bench.add(edge2);

  // A grade da fase vive aqui (centro da grade = origem local)
  const board = new THREE.Group();
  board.position.set(0, BENCH.y, BENCH.z);
  stage.add(board);

  return { scene, stage, board };
}

// ---------- Grade e gaveta da fase ----------
export class BoardView {
  constructor(board) {
    this.board = board;
    this.grid = null;
    this.hover = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3ef0ff, transparent: true, opacity: 0.25, depthWrite: false }));
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.visible = false;
    board.add(this.hover);
    this.trayN = 0;
  }

  setLevel(def, trayCount) {
    this.def = def;
    this.cs = cellSize(def);
    this.trayN = trayCount;
    if (this.grid) { this.board.remove(this.grid); this.grid.traverse(o => o.geometry?.dispose()); }
    const g = this.grid = new THREE.Group();
    const cs = this.cs, W = def.w * cs, H = def.h * cs;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.008, H + 0.02), MATS.plate);
    plate.position.y = 0.004;
    g.add(plate);
    const pts = [];
    for (let i = 0; i <= def.w; i++) { const x = -W / 2 + i * cs; pts.push(x, 0.0085, -H / 2, x, 0.0085, H / 2); }
    for (let j = 0; j <= def.h; j++) { const z = -H / 2 + j * cs; pts.push(-W / 2, 0.0085, z, W / 2, 0.0085, z); }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x233a6a })));
    // moldura neon
    const fr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.02, 0.001, H + 0.02)), new THREE.LineBasicMaterial({ color: 0x3ef0ff }));
    fr.position.y = 0.009;
    g.add(fr);
    // gaveta: faixa na frente da grade com um encaixe por peça
    const tz = this.trayZ();
    const tw = Math.max(1, trayCount) * TRAY_GAP + 0.02;
    const tray = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.012, TRAY_GAP + 0.01), new THREE.MeshLambertMaterial({ color: 0x0e1020 }));
    tray.position.set(0, 0.006, tz);
    g.add(tray);
    const sl = [];
    for (let i = 0; i < trayCount; i++) {
      const [x] = this.slotPos(i), r = TRAY_GAP * 0.42;
      sl.push(x - r, 0.013, tz - r, x + r, 0.013, tz - r, x + r, 0.013, tz - r, x + r, 0.013, tz + r,
        x + r, 0.013, tz + r, x - r, 0.013, tz + r, x - r, 0.013, tz + r, x - r, 0.013, tz - r);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
    g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x6a5020 })));
    this.board.add(g);
    this.hover.scale.set(cs * 0.96, cs * 0.96, 1);
  }

  trayZ() { return this.def.h * this.cs / 2 + 0.03 + TRAY_GAP / 2; }
  // Centro de uma casa em coordenadas locais da grade
  cellPos(x, y) { return [(x - (this.def.w - 1) / 2) * this.cs, -(y - (this.def.h - 1) / 2) * this.cs]; }
  slotPos(i) { return [(i - (this.trayN - 1) / 2) * TRAY_GAP, this.trayZ()]; }
  // Ponto local (x, z) → casa, ou null fora da grade. inTray = está sobre a gaveta.
  cellAt(lx, lz) {
    const x = Math.round(lx / this.cs + (this.def.w - 1) / 2);
    const y = Math.round(-lz / this.cs + (this.def.h - 1) / 2);
    if (x < 0 || y < 0 || x >= this.def.w || y >= this.def.h) return null;
    return { x, y };
  }
  inTray(lx, lz) { return lz > this.def.h * this.cs / 2 + 0.015 && lz < this.trayZ() + TRAY_GAP && Math.abs(lx) < BENCH.width / 2; }
  showHover(cell, ok) {
    this.hover.visible = !!cell;
    if (!cell) return;
    const [x, z] = this.cellPos(cell.x, cell.y);
    this.hover.position.set(x, 0.011, z);
    this.hover.material.color.setHex(ok ? 0x3ef0ff : 0xff3344);
  }
}

// ---------- Peças ----------
const GEO = {
  base: new THREE.CylinderGeometry(0.42, 0.45, 0.06, 24),
  ring: new THREE.TorusGeometry(0.44, 0.022, 6, 32),
  mirror: new THREE.BoxGeometry(0.82, 0.5, 0.05),
  mirrorBack: new THREE.BoxGeometry(0.82, 0.5, 0.02),
  splitter: new THREE.BoxGeometry(0.82, 0.5, 0.035),
  post: new THREE.BoxGeometry(0.05, 0.56, 0.07),
  filter: new THREE.CylinderGeometry(0.26, 0.26, 0.5, 20, 1, true),
  filterRing: new THREE.TorusGeometry(0.26, 0.03, 6, 20),
  prism: new THREE.CylinderGeometry(0.4, 0.4, 0.5, 3).rotateY(Math.PI / 2),
  emitBody: new THREE.BoxGeometry(0.62, 0.38, 0.5),
  nozzle: new THREE.CylinderGeometry(0.11, 0.14, 0.3, 14).rotateZ(Math.PI / 2),
  lens: new THREE.CircleGeometry(0.1, 14).rotateY(Math.PI / 2),
  wall: new THREE.BoxGeometry(0.92, 0.62, 0.92),
  crystal: new THREE.OctahedronGeometry(0.26, 0).scale(1, 1.5, 1),
  pedestal: new THREE.CylinderGeometry(0.16, 0.24, 0.16, 12),
  arrow: new THREE.ConeGeometry(0.06, 0.14, 4).rotateZ(-Math.PI / 2),
};

// Monta uma peça em tamanho 1 (uma casa = 1). A orientação vai num subgrupo `spin`.
export function makePiece(p) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  g.userData = { piece: p, spin, glow: null };
  const add = (geo, mat, y = 0, parent = spin) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; parent.add(m); return m; };
  if (p.type !== 'wall') {
    const base = add(GEO.base, MATS.base, 0.03, g);
    base.userData.isBase = true;
  }
  const ring = p.fixed ? (p.turn ? MATS.ringTurn : null) : MATS.ringMove;
  if (ring) { const r = add(GEO.ring, ring, 0.062, g); r.rotation.x = Math.PI / 2; }
  switch (p.type) {
    case 'mirror': {
      add(GEO.mirror, MATS.mirror, 0.31).position.z = 0.012;
      add(GEO.mirrorBack, MATS.mirrorBack, 0.31).position.z = -0.025;
      for (const s of [-1, 1]) add(GEO.post, MATS.frame, 0.3).position.x = s * 0.42;
      break;
    }
    case 'splitter': {
      add(GEO.splitter, MATS.splitter, 0.31);
      for (const s of [-1, 1]) add(GEO.post, MATS.frame, 0.3).position.x = s * 0.42;
      break;
    }
    case 'filter': {
      const col = COLOR_HEX[p.color];
      const mat = new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      add(GEO.filter, mat, 0.31);
      for (const y of [0.07, 0.56]) { const r = add(GEO.filterRing, neon(col), y); r.rotation.x = Math.PI / 2; }
      break;
    }
    case 'prism': {
      add(GEO.prism, MATS.prism, 0.31);
      const e = new THREE.Mesh(new THREE.EdgesGeometry(GEO.prism), new THREE.LineBasicMaterial({ color: 0xffffff }));
      e.position.y = 0.31; spin.add(e);
      // seta: por onde a luz tem que entrar
      const a = add(GEO.arrow, MATS.arrow, 0.08); a.position.x = -0.38;
      break;
    }
    case 'emitter': {
      const col = COLOR_HEX[p.color];
      add(GEO.emitBody, MATS.metal, 0.25).position.x = -0.08;
      add(GEO.nozzle, MATS.metal, 0.34).position.x = 0.32;
      add(GEO.lens, neon(col), 0.34).position.x = 0.475;
      const band = add(new THREE.BoxGeometry(0.64, 0.05, 0.52), neon(col), 0.4); band.position.x = -0.08;
      break;
    }
    case 'wall': add(GEO.wall, MATS.wall, 0.31); break;
    case 'crystal': {
      const col = p.color ? COLOR_HEX[p.color] : 0x2a2030;
      add(GEO.pedestal, MATS.metal, 0.11);
      const mat = new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.12, shininess: 90, transparent: true, opacity: 0.88 });
      const c = add(GEO.crystal, mat, 0.5);
      const halo = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0).scale(1, 1.5, 1),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.y = 0.5; spin.add(halo);
      // anel da cor pedida (cristal escuro: anel vermelho apagado)
      const rr = add(GEO.filterRing, neon(p.color ? col : 0x551018), 0.07, g); rr.rotation.x = Math.PI / 2; rr.scale.setScalar(1.25);
      g.userData.glow = { mat, halo, core: c, col: new THREE.Color(col) };
      break;
    }
  }
  return g;
}

export function setPieceRot(g, rot) { g.userData.spin.rotation.y = rot * Math.PI / 4; }

// Brilho do cristal: aceso pulsa forte; cor errada brilha fraco na cor que chega; o escuro
// atingido pisca vermelho.
const _c = new THREE.Color();
export function updateCrystal(g, info, t) {
  const gl = g.userData.glow;
  if (!gl || !info) return;
  const need = g.userData.piece.color;
  if (need === 0) {
    const hit = info.got !== 0;
    const f = hit ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
    gl.mat.emissive.setHex(hit ? 0xff2030 : 0x2a2030);
    gl.mat.emissiveIntensity = hit ? 0.4 + f : 0.1;
    gl.halo.material.color.setHex(0xff2030);
    gl.halo.material.opacity = hit ? 0.25 * f : 0;
    gl.core.position.y = 0.5;
    return;
  }
  if (info.ok) {
    const f = 0.5 + 0.5 * Math.sin(t * 4 + g.id);
    gl.mat.emissive.copy(gl.col);
    gl.mat.emissiveIntensity = 0.9 + 0.6 * f;
    gl.halo.material.color.copy(gl.col);
    gl.halo.material.opacity = 0.18 + 0.2 * f;
    gl.core.position.y = 0.5 + 0.04 * Math.sin(t * 2 + g.id);
    gl.core.rotation.y = t * 0.8;
  } else {
    gl.mat.emissive.copy(info.got ? _c.setHex(COLOR_HEX[info.got]) : gl.col);
    gl.mat.emissiveIntensity = info.got ? 0.35 : 0.1;
    gl.halo.material.opacity = 0;
    gl.core.position.y = 0.5;
  }
}

// ---------- Feixes ----------
// Cada raio é uma caixa fina (núcleo quase branco) dentro de outra maior e transparente
// (brilho), com mistura aditiva. Os objetos ficam guardados para reaproveitar.
export class Beams {
  constructor(board) {
    this.group = new THREE.Group();
    board.add(this.group);
    this.pool = [];
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.mats = new Map();
    this.count = 0;
  }
  mat(color, glow) {
    const k = color * 2 + (glow ? 1 : 0);
    if (!this.mats.has(k)) {
      const c = new THREE.Color(COLOR_HEX[color]);
      if (!glow) c.lerp(new THREE.Color(0xffffff), 0.45);
      this.mats.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: glow ? 0.28 : 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    }
    return this.mats.get(k);
  }
  set(segs, view) {
    const rays = mergeSegs(segs, view.def.w);
    const cs = view.cs, y = BEAM_H * cs + 0.002;
    while (this.pool.length < rays.length) {
      const core = new THREE.Mesh(this.geo, this.mat(7, false));
      const glow = new THREE.Mesh(this.geo, this.mat(7, true));
      core.renderOrder = 2; glow.renderOrder = 3;
      this.group.add(core, glow);
      this.pool.push({ core, glow });
    }
    rays.forEach((r, i) => {
      const [x0, z0] = view.cellPos(r.x0, r.y0), [x1, z1] = view.cellPos(r.x1, r.y1);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(-(z1 - z0), x1 - x0);
      const { core, glow } = this.pool[i];
      for (const [m, th] of [[core, 0.006], [glow, 0.02]]) {
        m.visible = true;
        m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
        m.rotation.set(0, ang, 0);
        m.scale.set(len, th, th);
      }
      core.material = this.mat(r.color, false);
      glow.material = this.mat(r.color, true);
    });
    for (let i = rays.length; i < this.pool.length; i++) { this.pool[i].core.visible = false; this.pool[i].glow.visible = false; }
    this.count = rays.length;
  }
  // brilho tremendo de leve
  update(t) {
    const f = 0.24 + 0.06 * Math.sin(t * 9);
    for (const [k, m] of this.mats) if (k & 1) m.opacity = f;
  }
}

