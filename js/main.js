// Liga a lógica da bancada à tela, ao Quest (controles ou mãos) e ao mouse.
import * as THREE from '../vendor/three/three.module.js';
import { LEVELS, GROUPS } from './levels.js';
import { Puzzle, canTurn } from './puzzle.js';
import { solve, applySolution } from './solver.js';
import { buildScene, BoardView, Beams, makePiece, setPieceRot, updateCrystal, BENCH, TRAY_SCALE, TRAY_GAP } from './scene.js';
import { Panel, Label, UI } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave, unlockedUpTo, recordWin } from './save.js';

const save = loadSave();
const sfx = new Sfx();
sfx.humOn = save.hum;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SHOWCASE = 15; // fase mostrada resolvida atrás do menu principal (Arco-íris)

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildScene();
const { scene, stage, board } = world;
const view = new BoardView(board);
const beams = new Beams(board);
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.03, 40);
rig.add(camera);

const panel = new Panel(0.8);
stage.add(panel.mesh);
const fpsLabel = new Label(0.14);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);
// Letreiro da fase (só no VR; no PC o texto vai para o HTML)
const sign = new Label(0.7, 768, 300);
sign.mesh.position.set(0, BENCH.y + 0.24, BENCH.z - 0.56);
sign.mesh.rotation.x = -0.15;
sign.mesh.visible = false;
stage.add(sign.mesh);
// Botão de pausa na bancada (para quem joga só com as mãos)
const pauseBtn = new Label(0.13, 256, 90);
pauseBtn.set('❚❚ Pausa');
pauseBtn.mesh.position.set(0.56, BENCH.y + 0.02, BENCH.z + 0.5);
pauseBtn.mesh.rotation.x = -Math.PI / 2 + 0.5;
pauseBtn.mesh.visible = false;
stage.add(pauseBtn.mesh);

// No PC a câmera fica alta e um pouco à frente da bancada, olhando a grade de cima.
const DESK_CAM = new THREE.Vector3(0, BENCH.y + 0.8, BENCH.z + 0.78);
const DESK_LOOK = new THREE.Vector3(0, BENCH.y - 0.02, BENCH.z + 0.1);
function fitDeskFov() {
  const aspect = window.innerWidth / window.innerHeight;
  const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(58) / 2) / aspect);
  camera.fov = Math.max(48, THREE.MathUtils.radToDeg(h));
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
function deskCamera() {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  stage.position.y = 0;
  camera.position.copy(DESK_CAM);
  camera.lookAt(DESK_LOOK);
  fitDeskFov();
  // No PC o painel fica menor, senão o topo sai da tela.
  panel.mesh.scale.setScalar(0.72);
  panel.mesh.position.set(0, BENCH.y + 0.2, BENCH.z + 0.08);
  panel.mesh.lookAt(DESK_CAM);
  sign.mesh.visible = false;
}
deskCamera();

// ---------- Estado ----------
let app = 'menu';      // 'menu' | 'playing' | 'paused' | 'winning' | 'won'
let puzzle = null;
let levelIndex = 0;
let levelTime = 0;
let winTimer = 0;
let time = 0;
let lastRes = null;
let crystalInfo = new Map();
const lit = new Set();       // cristais acesos (para tocar o acorde só quando acende)
const alarmed = new Set();   // cristais escuros recebendo luz
const meshes = new Map();    // id da peça → objeto 3D
const holds = { mouse: null, left: null, right: null };
const anyHeld = () => !!(holds.mouse || holds.left || holds.right);

function loadBoard(def) {
  cancelHolds();
  puzzle = new Puzzle(def);
  view.setLevel(def, puzzle.trayPieces.length);
  for (const g of meshes.values()) board.remove(g);
  meshes.clear();
  for (const p of puzzle.pieces) {
    const g = makePiece(p);
    board.add(g);
    meshes.set(p.id, g);
  }
  lit.clear(); alarmed.clear();
  placeMeshes();
  refresh(null, true);
}

// Põe cada peça na sua casa ou no encaixe da gaveta (as seguradas são postas pela mão).
function placeMeshes() {
  const heldIds = new Set(Object.values(holds).filter(h => h && h.mode === 'move').map(h => h.piece.id));
  for (const p of puzzle.pieces) {
    const g = meshes.get(p.id);
    setPieceRot(g, p.rot);
    if (heldIds.has(p.id)) continue;
    if (p.x >= 0) {
      const [x, z] = view.cellPos(p.x, p.y);
      g.position.set(x, 0, z);
      g.scale.setScalar(view.cs);
    } else {
      const [x, z] = view.slotPos(p.slot);
      g.position.set(x, 0.012, z);
      g.scale.setScalar(TRAY_SCALE);
    }
  }
}

// Recalcula os feixes (preview = peça segurada numa casa, sem mexer no estado).
function refresh(preview = null, silent = false) {
  const res = puzzle.trace(preview);
  lastRes = res;
  beams.set(res.segs, view);
  crystalInfo = new Map(res.crystals.map(c => [c.piece.id, c]));
  for (const c of res.crystals) {
    const id = c.piece.id;
    if (c.piece.color) {
      if (c.ok && !lit.has(id)) { lit.add(id); if (!silent) { sfx.crystal(c.piece.color); pulseAll(0.3, 40); } }
      else if (!c.ok) lit.delete(id);
    } else {
      if (c.got && !alarmed.has(id)) { alarmed.add(id); if (!silent) { sfx.alarm(); pulseAll(0.6, 120); } }
      else if (!c.got) alarmed.delete(id);
    }
  }
  sfx.setHum(res.segs.length / 45);
  updateInfo();
}

function checkWin() {
  if (app !== 'playing' || anyHeld() || !puzzle.won) return;
  app = 'winning';
  winTimer = 1.6;
  sfx.win();
  pulseAll(0.8, 200);
  updateHint();
}

function finishLevel() {
  recordWin(save, levelIndex, puzzle.moves, levelTime);
  storeSave(save);
  app = 'won';
  showScreen('won');
  updateHint();
}

// ---------- Mexer nas peças ----------
const pickable = (p) => !p.fixed || canTurn(p);

function rotatePiece(p, steps) {
  if (app !== 'playing' || !p) return false;
  if (!puzzle.rotate(p, steps)) { if (!canTurn(p)) sfx.deny(); return false; }
  sfx.turn();
  setPieceRot(meshes.get(p.id), p.rot);
  const h = Object.values(holds).find(x => x && x.piece === p);
  if (h) { h.rot0 += steps; h.lastKey = null; updateHoldPreview(h); }
  else { refresh(); checkWin(); }
  return true;
}

function startHold(src, p, { touch = false, quat = null, fwd = null, button = null } = {}) {
  if (app !== 'playing' || !p || !pickable(p)) return false;
  if (Object.values(holds).some(h => h && h.piece === p)) return false;
  holds[src] = {
    piece: p, src, mode: p.fixed ? 'turn' : 'move', touch, button,
    rot0: p.rot, q0: quat ? quat.clone() : null, fwd: fwd ? fwd.clone() : null,
    cand: null, valid: false, toTray: false, lastKey: null,
  };
  sfx.grab();
  pulse(src, 0.35, 25);
  return true;
}

// Peça segurada sobre o ponto local (x, z) da bancada.
function moveHold(h, lx, lz) {
  const g = meshes.get(h.piece.id);
  const cell = view.cellAt(lx, lz);
  h.cand = cell;
  h.valid = !!cell && puzzle.isFree(cell.x, cell.y, h.piece);
  h.toTray = !cell && view.inTray(lx, lz);
  g.position.set(lx, 0.05, lz);
  g.scale.setScalar(cell ? view.cs : TRAY_SCALE);
  view.showHover(cell, h.valid);
  updateHoldPreview(h);
}

function updateHoldPreview(h) {
  if (h.mode !== 'move') { refresh(); return; }
  const key = h.valid ? `${h.cand.x},${h.cand.y},${h.piece.rot}` : 'fora';
  if (key === h.lastKey) return;
  h.lastKey = key;
  refresh(h.valid ? { piece: h.piece, x: h.cand.x, y: h.cand.y, rot: h.piece.rot } : { piece: h.piece, x: -1, y: -1 }, true);
}

function dropHold(src) {
  const h = holds[src];
  if (!h) return;
  holds[src] = null;
  view.showHover(null);
  if (h.mode === 'move') {
    const p = h.piece;
    if (h.valid) { puzzle.place(p, h.cand.x, h.cand.y); sfx.place(); pulse(src, 0.5, 30); }
    else if (h.toTray || !h.cand) { if (p.x >= 0) puzzle.toTray(p); sfx.back(); }
    else sfx.deny();   // casa ocupada: a peça volta para onde estava
  }
  placeMeshes();
  refresh();
  checkWin();
}

function cancelHolds() {
  for (const k of Object.keys(holds)) holds[k] = null;
  view.showHover(null);
  if (puzzle) { placeMeshes(); refresh(null, true); }
}

// Peça apontada por um raio: primeiro a malha, depois a casa (ou o encaixe da gaveta) sob o raio.
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.002;   // as arestas do prisma não podem pegar o raio de longe
const benchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function benchPoint(ray) {
  board.getWorldPosition(_v);
  benchPlane.constant = -_v.y;
  const hit = ray.intersectPlane(benchPlane, _p);
  if (!hit) return null;
  const l = board.worldToLocal(_p.clone());
  return { x: l.x, z: l.z, dist: ray.origin.distanceTo(hit) };
}
function pieceFromObject(o) {
  while (o && !o.userData?.piece) o = o.parent;
  return o?.userData.piece || null;
}
function pieceOnPoint(pt) {
  if (!pt || !puzzle) return null;
  const cell = view.cellAt(pt.x, pt.z);
  if (cell) return puzzle.pieceAt(cell.x, cell.y);
  if (view.inTray(pt.x, pt.z)) {
    const i = Math.round(pt.x / TRAY_GAP + (view.trayN - 1) / 2);
    return puzzle.trayPieces.find(p => p.slot === i && p.x < 0) || null;
  }
  return null;
}
function pickPiece(ray) {
  if (!puzzle) return null;
  raycaster.ray.copy(ray);
  for (const hit of raycaster.intersectObjects([...meshes.values()], true)) {
    const p = pieceFromObject(hit.object);
    if (p && pickable(p) && !Object.values(holds).some(h => h && h.piece === p && h.mode === 'move')) return p;
  }
  const p = pieceOnPoint(benchPoint(ray));
  return p && pickable(p) ? p : null;
}

// Destaque: peça apontada sobe um pouquinho (as seguradas são postas pela mão).
let hoverIds = new Set();
function setHoverPieces(list) {
  const ids = new Set(list.filter(Boolean).map(p => p.id));
  const movingIds = new Set(Object.values(holds).filter(h => h && h.mode === 'move').map(h => h.piece.id));
  for (const p of puzzle.pieces) {
    if (movingIds.has(p.id) || (!ids.has(p.id) && !hoverIds.has(p.id))) continue;
    meshes.get(p.id).position.y = (p.x >= 0 ? 0 : 0.012) + (ids.has(p.id) ? 0.012 : 0);
  }
  hoverIds = ids;
}

// ---------- Mouse (PC) ----------
const mouse = { ndc: new THREE.Vector2(), inside: false, down: null, hover: null };
function setMouse(e) {
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.inside = true;
}
function mouseRay() { raycaster.setFromCamera(mouse.ndc, camera); return raycaster.ray.clone(); }
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerleave', () => { mouse.inside = false; });
renderer.domElement.addEventListener('pointermove', (e) => {
  setMouse(e);
  const d = mouse.down;
  if (d && !holds.mouse && d.piece && !d.piece.fixed && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) startHold('mouse', d.piece);
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  setMouse(e);
  const ray = mouseRay();
  if (panel.visible) {
    if (e.button !== 0) return;
    raycaster.ray.copy(ray);
    const a = panel.actionAt(panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv));
    if (a) { sfx.click(); a(); }
    return;
  }
  if (app !== 'playing') return;
  const p = holds.mouse?.piece || pickPiece(ray);
  if (e.button === 2) { rotatePiece(p, -1); return; }
  if (e.button === 0) mouse.down = { piece: p, sx: e.clientX, sy: e.clientY };
});
window.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  const d = mouse.down;
  mouse.down = null;
  if (holds.mouse) dropHold('mouse');
  else if (d?.piece && app === 'playing') rotatePiece(d.piece, -1);   // clique sem arrastar gira
});
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (app !== 'playing' || panel.visible) return;
  const p = holds.mouse?.piece || mouse.hover;
  if (p) rotatePiece(p, e.deltaY > 0 ? -1 : 1);
}, { passive: false });
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'p') togglePause();
  else if (k === 'r' && app === 'playing') { const p = holds.mouse?.piece || mouse.hover; if (p) rotatePiece(p, e.shiftKey ? 1 : -1); }
  else if (k === 'f') { save.fps = !save.fps; storeSave(save); }
});
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (!renderer.xr.isPresenting) fitDeskFov();
});

function updateMouse() {
  if (!mouse.inside && !holds.mouse) { mouse.hover = null; return; }
  const ray = mouseRay();
  if (panel.visible) {
    raycaster.ray.copy(ray);
    const i = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
    panel.setHover(i);
    renderer.domElement.style.cursor = i >= 0 && panel.actionAt(i) ? 'pointer' : 'default';
    mouse.hover = null;
    return;
  }
  const h = holds.mouse;
  if (h) {
    const pt = benchPoint(ray);
    if (pt) moveHold(h, pt.x, pt.z);
    renderer.domElement.style.cursor = 'grabbing';
    mouse.hover = h.piece;
    return;
  }
  mouse.hover = app === 'playing' ? pickPiece(ray) : null;
  renderer.domElement.style.cursor = mouse.hover ? 'grab' : 'default';
}

// ---------- VR ----------
const ctrls = [];
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  const grip = renderer.xr.getControllerGrip(i);
  rig.add(ctrl); rig.add(grip);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0x3ef0ff, transparent: true, opacity: 0.7 }));
  laser.visible = false;
  ctrl.add(laser);
  // ponteirinho na mão (não há modelo do controle)
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3ef0ff }));
  ctrl.add(tip);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.09, 10).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a3048 }));
  body.position.z = 0.05;
  grip.add(body);
  const entry = { ctrl, grip, laser, source: null, side: null, prev: [], stickArmed: true, hoverIndex: -1, hoverPause: false, point: null, touch: null };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => { entry.source = e.data; entry.side = e.data.handedness === 'left' ? 'left' : 'right'; body.visible = !e.data.hand; });
  ctrl.addEventListener('disconnected', () => { if (entry.side && holds[entry.side]) dropHold(entry.side); entry.source = null; entry.side = null; });
  ctrl.addEventListener('selectstart', () => onPress(entry, 'select'));
  ctrl.addEventListener('selectend', () => onRelease(entry, 'select'));
  ctrl.addEventListener('squeezestart', () => onPress(entry, 'squeeze'));
  ctrl.addEventListener('squeezeend', () => onRelease(entry, 'squeeze'));
}
const entryFor = (side) => ctrls.find(e => e.side === side && e.source);

function pulse(side, v, ms) {
  if (side !== 'left' && side !== 'right') return;
  try { entryFor(side)?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v, ms); } catch { /* sem vibração */ }
}
function pulseAll(v, ms) { pulse('left', v, ms); pulse('right', v, ms); }

function ctrlRay(e) {
  e.ctrl.updateMatrixWorld();
  e.ctrl.matrixWorld.decompose(_p, _q, _s);
  return { ray: new THREE.Ray(_p.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(_q).normalize()), quat: _q.clone() };
}

function onPress(entry, button) {
  sfx.unlock();
  if (!entry.side) return;
  if (panel.visible) {
    if (button !== 'select') return;
    const a = panel.actionAt(entry.hoverIndex);
    if (a) { sfx.click(); a(); }
    return;
  }
  if (entry.hoverPause && button === 'select') { sfx.click(); togglePause(); return; }
  if (app !== 'playing' || holds[entry.side]) return;
  const { ray, quat } = ctrlRay(entry);
  const touch = entry.touch;
  const p = touch || pickPiece(ray);
  if (!p) return;
  startHold(entry.side, p, { touch: !!touch, quat, fwd: ray.direction, button });
}
function onRelease(entry, button) {
  const h = entry.side && holds[entry.side];
  if (h && h.button === button) dropHold(entry.side);
}

// Peça ao alcance da mão (a 7 cm), para pegar encostando.
function touchPiece(e) {
  if (!puzzle) return null;
  const src = e.source?.hand ? e.ctrl : e.grip;
  src.getWorldPosition(_v);
  let best = null, bd = 0.07;
  for (const p of puzzle.pieces) {
    if (!pickable(p) || Object.values(holds).some(h => h && h.piece === p)) continue;
    const g = meshes.get(p.id);
    g.getWorldPosition(_p);
    _p.y += g.scale.x * 0.3;
    const d = _p.distanceTo(_v);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// Giro do pulso em volta do eixo do controle desde que pegou (decomposição swing-twist).
function twistSteps(h, quat) {
  const qr = quat.clone().multiply(h.q0.clone().invert());
  const f = h.fwd;
  let tw = 2 * Math.atan2(qr.x * f.x + qr.y * f.y + qr.z * f.z, qr.w);
  if (tw > Math.PI) tw -= 2 * Math.PI;
  if (tw < -Math.PI) tw += 2 * Math.PI;
  return -Math.round(tw / (Math.PI / 4));
}

function updateVR() {
  const hovered = [];
  for (const e of ctrls) {
    e.hoverIndex = -1; e.hoverPause = false; e.laser.visible = false; e.touch = null;
    if (!e.source) continue;
    const { ray, quat } = ctrlRay(e);
    raycaster.ray.copy(ray);
    if (panel.visible) {
      const hit = raycaster.intersectObject(panel.mesh)[0];
      e.laser.visible = true;
      e.laser.scale.z = hit ? hit.distance : 1.2;
      e.hoverIndex = panel.pick(hit?.uv);
      continue;
    }
    if (pauseBtn.mesh.visible) {
      const hit = raycaster.intersectObject(pauseBtn.mesh)[0];
      if (hit && hit.distance < 1.6) { e.hoverPause = true; e.laser.visible = true; e.laser.scale.z = hit.distance; continue; }
    }
    if (app !== 'playing') continue;
    const h = holds[e.side];
    const pt = benchPoint(ray);
    e.laser.visible = !(h && h.touch);
    e.laser.scale.z = pt ? Math.min(pt.dist, 2) : 1.2;
    if (h) {
      if (h.mode === 'move') {
        if (h.touch) { e.grip.getWorldPosition(_v); const l = board.worldToLocal(_v.clone()); moveHold(h, l.x, l.z); }
        else if (pt) moveHold(h, pt.x, pt.z);
      }
      if (canTurn(h.piece)) {
        const target = h.rot0 + twistSteps(h, quat);
        if (((target % 8) + 8) % 8 !== h.piece.rot && puzzle.setRot(h.piece, target)) {
          sfx.turn(); pulse(e.side, 0.25, 15);
          setPieceRot(meshes.get(h.piece.id), h.piece.rot);
          h.lastKey = null;
          updateHoldPreview(h);
        }
      }
      hovered.push(h.piece);
    } else {
      e.touch = touchPiece(e);
      const p = e.touch || pickPiece(ray);
      e.point = p;
      hovered.push(p);
    }
  }
  if (panel.visible) panel.setHover(ctrls.find(e => e.hoverIndex >= 0)?.hoverIndex ?? -1);
  return hovered;
}

function pollButtons() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp || e.source.hand) continue;
    const b = gp.buttons.map(x => x.pressed);
    const edge = (i) => b[i] && !e.prev[i];
    const target = holds[e.side]?.piece || e.point;
    if (edge(5)) togglePause();                                        // B ou Y
    if (edge(3) && target) rotatePiece(target, -1);                    // aperta o thumbstick: 45° horário
    if (edge(4) && target) rotatePiece(target, 1);                     // A ou X: 45° anti-horário
    const sx = gp.axes?.[2] ?? 0;
    if (Math.abs(sx) < 0.3) e.stickArmed = true;
    else if (Math.abs(sx) > 0.75 && e.stickArmed && target) { e.stickArmed = false; rotatePiece(target, sx > 0 ? -1 : 1); }
    e.prev = b;
  }
}

let recenterIn = 0;
function recenter() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
  // A bancada acompanha a altura do jogador (fica na altura da cintura).
  stage.position.y = clamp(camera.position.y - 1.62, -0.45, 0.35);
}
renderer.xr.addEventListener('sessionstart', () => {
  recenterIn = 5;
  mouse.down = null; holds.mouse = null;
  panel.mesh.rotation.set(0, 0, 0);
  panel.mesh.scale.setScalar(1);
  panel.mesh.position.set(0, 1.4, -1.0);
  updateHint();
});
renderer.xr.addEventListener('sessionend', () => {
  cancelHolds();
  deskCamera();
  updateHint();
});

// ---------- Telas ----------
function startLevel(i) {
  levelIndex = clamp(i, 0, LEVELS.length - 1);
  loadBoard(LEVELS[levelIndex]);
  levelTime = 0;
  app = 'playing';
  panel.hide();
  updateHint();
}

function togglePause() {
  if (app === 'playing') { cancelHolds(); app = 'paused'; showScreen('pause'); }
  else if (app === 'paused') { app = 'playing'; panel.hide(); }
  updateHint();
}

function goMenu() {
  levelIndex = SHOWCASE;
  loadBoard(LEVELS[SHOWCASE]);
  applySolution(puzzle, solve(puzzle.def));
  placeMeshes();
  refresh(null, true);
  app = 'menu';
  showScreen('main');
  updateHint();
}

function showScreen(name) {
  const vr = renderer.xr.isPresenting;
  panel.show((p) => {
    if (name === 'main') {
      p.title('Prisma', 84);
      p.text('Gire espelhos, divida e misture a luz para acender os cristais.', 512, 150, { size: 28, color: UI.dim });
      const next = unlockedUpTo(save, LEVELS.length);
      p.button(save.done[0] ? `Continuar: fase ${next + 1}` : 'Começar', () => startLevel(next), 262, 210, 500, 100, { size: 40 });
      p.button('Escolher fase', () => showScreen('levels'), 262, 330, 500, 84);
      p.button('Como jogar', () => showScreen('help'), 262, 434, 500, 84);
      p.button(`Zumbido: ${save.hum ? 'sim' : 'não'}`, () => { save.hum = sfx.humOn = !save.hum; storeSave(save); refresh(null, true); showScreen('main'); }, 262, 538, 245, 74, { size: 28 });
      p.button(`FPS: ${save.fps ? 'sim' : 'não'}`, () => { save.fps = !save.fps; storeSave(save); showScreen('main'); }, 517, 538, 245, 74, { size: 28 });
      const n = Object.keys(save.done).length;
      p.text(`${n} de ${LEVELS.length} fases vencidas`, 512, 660, { size: 26, color: UI.gold });
      p.text(vr ? 'Aponte e aperte o gatilho para escolher' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR"', 512, 724, { size: 22, color: UI.dim });
    } else if (name === 'levels') {
      p.title('Fases', 62);
      const up = unlockedUpTo(save, LEVELS.length);
      GROUPS.forEach((g, r) => {
        const y = 110 + r * 148;
        p.text(g.name, 112, y + 64, { size: 30, bold: true, color: [UI.edge, '#9ff0ff', UI.gold, UI.pink][r] });
        for (let i = g.from; i <= g.to; i++) {
          const c = i - g.from;
          p.tile(214 + c * 160, y, 150, 128, {
            num: i + 1, name: LEVELS[i].name, done: !!save.done[i], locked: i > up, master: i === g.to, action: () => startLevel(i),
          });
        }
      });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 712, 300, 70);
    } else if (name === 'help') {
      p.title('Como jogar', 64);
      const rows = [
        'Cada cristal pede uma cor. Ele só acende se a soma',
        'exata da luz que chega nele for essa cor.',
        'Vermelho+verde = amarelo, vermelho+azul = magenta,',
        'verde+azul = ciano, os três = branco. Escuro: nada.',
        'Espelho reflete. Divisor: metade passa, metade reflete.',
        'Filtro: só a cor dele passa. Prisma: separa o branco.',
        'Anel dourado: peça que se move. Azul: só gira.',
        ...(vr ? [
          'Gatilho ou botão lateral: pega (aponte ou encoste).',
          'Gire o pulso, aperte o thumbstick ou A/X: 45°.',
        ] : [
          'Arraste a peça. Clique, botão direito, roda ou R: gira.',
          'Solte na gaveta para tirar da bancada. Esc: pausa.',
        ]),
      ];
      rows.forEach((t, i) => p.text(t, 64, 136 + i * 54, { size: 28, align: 'left' }));
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 640, 300, 80);
    } else if (name === 'pause') {
      p.title('Pausa', 72);
      p.text(`Fase ${levelIndex + 1}: ${LEVELS[levelIndex].name}`, 512, 140, { size: 30, color: UI.dim });
      p.button('Continuar', () => togglePause(), 262, 200, 500, 88);
      p.button('Recomeçar a fase', () => startLevel(levelIndex), 262, 304, 500, 88);
      p.button('Escolher fase', () => showScreen('levels'), 262, 408, 500, 88);
      p.button('Como jogar', () => showScreen('help'), 262, 512, 245, 84, { size: 30 });
      p.button('Menu principal', () => goMenu(), 517, 512, 245, 84, { size: 30 });
      p.button('Recentralizar', () => { recenter(); togglePause(); }, 262, 612, 500, 84, { size: 30, locked: !vr });
    } else if (name === 'won') {
      const d = save.done[levelIndex];
      p.title('Todos os cristais acesos!', 84);
      p.text(`Fase ${levelIndex + 1}: ${LEVELS[levelIndex].name}`, 512, 160, { size: 32, color: UI.gold });
      p.text(`Movimentos: ${puzzle.moves}   ·   Tempo: ${levelTime.toFixed(1)} s`, 512, 222, { size: 30 });
      if (d) p.text(`Melhor: ${d.moves} movimentos, ${d.time.toFixed(1)} s`, 512, 268, { size: 24, color: UI.dim });
      if (levelIndex < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(levelIndex + 1), 262, 320, 500, 100, { size: 40 });
      else p.text('Você venceu as 20 fases. Mestre da luz!', 512, 370, { size: 36, bold: true, color: UI.pink });
      p.button('Repetir', () => startLevel(levelIndex), 262, 446, 245, 84);
      p.button('Fases', () => showScreen('levels'), 517, 446, 245, 84);
      p.button('Menu principal', () => goMenu(), 262, 550, 500, 84);
    }
  });
}

// ---------- Textos ----------
const hintEl = document.getElementById('hint');
const infoEl = document.getElementById('info');
const fpsEl = document.getElementById('fps');
function statusText() {
  if (!lastRes) return '';
  const parts = [`Cristais: ${lastRes.lit} de ${lastRes.need}`];
  if (lastRes.alarm) parts.push('cristal escuro recebendo luz!');
  parts.push(`movimentos: ${puzzle.moves}`);
  return parts.join(' · ');
}
function updateInfo() {
  const vr = renderer.xr.isPresenting;
  const show = app === 'playing' || app === 'winning' || app === 'paused';
  const def = LEVELS[levelIndex];
  sign.mesh.visible = vr && show;
  if (vr && show) {
    sign.setLines([
      { text: `${levelIndex + 1}. ${def.name}`, size: 46, bold: true, color: UI.edge },
      { text: def.hint, size: 30 },
      { text: app === 'winning' ? 'Todos acesos!' : statusText(), size: 32, bold: true, color: lastRes?.alarm ? '#ff5060' : UI.gold },
    ]);
  }
  if (!vr && show) {
    infoEl.innerHTML = `<b>${levelIndex + 1}. ${def.name}</b><br>${def.hint}<br><i class="${lastRes?.alarm ? 'bad' : ''}">${app === 'winning' ? 'Todos acesos!' : statusText()}</i>`;
  } else infoEl.innerHTML = '';
}
function updateHint() {
  pauseBtn.mesh.visible = renderer.xr.isPresenting && app === 'playing';
  updateInfo();
  if (renderer.xr.isPresenting) { hintEl.textContent = ''; return; }
  hintEl.innerHTML = app === 'playing'
    ? '<span>Arraste as peças da gaveta para a grade · Clique, botão direito, roda ou R: gira 45° · Solte na gaveta para tirar · Esc: pausa</span>'
    : '<span>Clique nas opções do painel</span>';
}

const vrBtn = document.getElementById('vr');
async function setupVR() {
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) {
      vrBtn.textContent = 'Erro ao entrar em VR';
      console.error(err);
    }
  };
}
setupVR();

// ---------- Laço principal ----------
let lastT = performance.now();
let fpsFrames = 0, fpsTime = 0;

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  const vr = renderer.xr.isPresenting;
  if (recenterIn > 0 && --recenterIn === 0) recenter();
  rig.updateMatrixWorld(true);
  pollButtons();

  let hovered = [];
  if (vr) hovered = updateVR();
  else { updateMouse(); hovered = [mouse.hover]; }
  if (app === 'playing') setHoverPieces(hovered); else setHoverPieces([]);

  if (app === 'playing') levelTime += dt;
  if (app === 'winning') { winTimer -= dt; if (winTimer <= 0) finishLevel(); }

  for (const [id, info] of crystalInfo) updateCrystal(meshes.get(id), info, time);
  beams.update(time);

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
    if (app === 'playing') updateInfo();
  }
  renderer.render(scene, camera);
}

// Para testes no console:
//   prisma.dev.loadLevel(5)   abre a fase 5 (1 a 20), já liberada
//   prisma.dev.solve()        o robô resolve a fase aberta (devolve true se venceu)
//   prisma.dev.advance(2)     roda 2 s de jogo de uma vez (a vitória mostra o painel em 1,6 s)
//   prisma.dev.state()        resumo: fase, cristais acesos, vitória, tela atual
const dev = {
  loadLevel(n) { startLevel(n - 1); return `${levelIndex + 1}. ${LEVELS[levelIndex].name}`; },
  solve() {
    if (!puzzle || app !== 'playing') return false;
    cancelHolds();
    const sol = solve(puzzle.def);
    if (!sol) return false;
    const ok = applySolution(puzzle, sol);
    placeMeshes();
    refresh();
    checkWin();
    return ok;
  },
  advance(sec) { for (let i = 0; i < sec * 72; i++) { lastT = performance.now() - 1000 / 72; frame(); } return dev.state(); },
  state() {
    return { app, level: levelIndex + 1, name: LEVELS[levelIndex].name, lit: lastRes?.lit, need: lastRes?.need, alarm: lastRes?.alarm, won: !!lastRes?.won, moves: puzzle?.moves, beams: beams.count };
  },
  unlockAll() { LEVELS.forEach((_, i) => { if (!save.done[i]) save.done[i] = { moves: 99, time: 999 }; }); storeSave(save); if (panel.visible) showScreen('levels'); },
};
window.prisma = { get puzzle() { return puzzle; }, get app() { return app; }, save, startLevel, goMenu, showScreen, togglePause, rotatePiece, dev, camera, world, view };

goMenu();
renderer.setAnimationLoop(frame);
