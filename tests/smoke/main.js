// Teste do main.js sem navegador: roda o jogo inteiro com um navegador e um renderer de
// mentira (tests/smoke/env.js e three-wrap.js) e joga com o mouse e com um controle de VR
// falso. Chamado pelo tests/run.js; sozinho:
//   node --import ./tests/smoke/register.js tests/smoke/main.js
// Não toca som (não existe AudioContext aqui).
import './env.js';
import * as THREE from '../../vendor/three/three.module.js';

await import('../../js/main.js');
const P = window.prisma, dev = P.dev, R = globalThis.__renderer;
let fails = 0, count = 0;
const ok = (c, m) => { count++; if (!c) { fails++; console.log('  FALHOU: ' + m); } };
const frames = (n) => { for (let i = 0; i < n; i++) R.loop(); };
const fire = (list, e) => (list || []).forEach(f => f({ preventDefault() {}, button: 0, shiftKey: false, ...e }));
const cv = R.domElement.handlers, win = globalThis.windowHandlers;

frames(3);
ok(P.app === 'menu', 'abre no menu');
ok(dev.state().won, 'vitrine do menu (Arco-íris) aparece resolvida');

// Robô em todas as fases, pelo objeto de depuração
for (let n = 1; n <= 20; n++) {
  dev.loadLevel(n);
  ok(P.app === 'playing' && !dev.state().won, `fase ${n} abre sem vitória`);
  const solved = dev.solve();
  dev.advance(2);
  ok(solved && P.app === 'won', `fase ${n}: dev.solve() vence e mostra o painel (${JSON.stringify(dev.state())})`);
}
ok(Object.keys(P.save.done).length === 20, 'progresso das 20 fases salvo');

// ---------- Mouse: fase 1 ----------
const toScreen = (lx, lz, ly = 0) => {
  const v = P.world.board.localToWorld(new THREE.Vector3(lx, ly, lz)).project(P.camera);
  return { clientX: (v.x + 1) / 2 * innerWidth, clientY: (1 - v.y) / 2 * innerHeight };
};
dev.loadLevel(1);
{
  const mirror = P.puzzle.trayPieces[0];
  const [sx, sz] = P.view.slotPos(mirror.slot);
  const [cx, cz] = P.view.cellPos(3, 1);
  const a = toScreen(sx, sz, 0.02), b = toScreen(cx, cz);
  fire(cv.pointermove, a); frames(1);
  fire(cv.pointerdown, a);
  fire(cv.pointermove, { clientX: a.clientX + 20, clientY: a.clientY - 20 }); frames(1);
  fire(cv.pointermove, b); frames(2);
  ok(P.view.hover.visible && P.view.hover.material.color.getHex() === 0x3ef0ff, 'casa livre marcada enquanto arrasta');
  fire(win.pointerup, b);
  ok(mirror.x === 3 && mirror.y === 1, `mouse arrasta o espelho da gaveta para a casa (${mirror.x},${mirror.y})`);
  for (let i = 0; i < 4 && P.app === 'playing'; i++) { fire(cv.pointerdown, { ...b, button: 2 }); fire(win.pointerup, { ...b, button: 2 }); }
  ok(P.app === 'winning', `botão direito gira até acender (rot ${mirror.rot})`);
  dev.advance(2);
  ok(P.app === 'won', 'painel de vitória depois de jogar com o mouse');
}
// Arrastar para fora volta para a gaveta; casa ocupada recusa
dev.loadLevel(2);
{
  const [m1, m2] = P.puzzle.trayPieces;
  P.puzzle.place(m1, 3, 1);
  frames(1);
  const drag = (from, to) => {
    fire(cv.pointermove, from); frames(1);
    fire(cv.pointerdown, from);
    fire(cv.pointermove, { clientX: from.clientX + 15, clientY: from.clientY + 15 }); frames(1);
    fire(cv.pointermove, to); frames(1);
    fire(win.pointerup, to); frames(1);
  };
  const [ex, ez] = P.view.cellPos(0, 1);        // casa do emissor
  const [sx, sz] = P.view.slotPos(m2.slot);
  drag(toScreen(sx, sz, 0.02), toScreen(ex, ez));
  ok(m2.x === -1, 'soltar em casa ocupada devolve a peça');
  const [cx, cz] = P.view.cellPos(3, 1);
  const [tx, tz] = P.view.slotPos(m1.slot);
  drag(toScreen(cx, cz), toScreen(tx, tz));
  ok(m1.x === -1, 'arrastar da grade para a gaveta tira a peça');
  ok(P.puzzle.moves >= 2, 'movimentos contados');
}
// Teclado: Esc pausa e volta; roda gira a peça apontada
fire(win.keydown, { key: 'Escape' });
ok(P.app === 'paused', 'Esc pausa');
fire(win.keydown, { key: 'Escape' });
ok(P.app === 'playing', 'Esc continua');
dev.loadLevel(3);
{
  const fixedMirror = P.puzzle.pieces.find(p => p.type === 'mirror' && p.fixed);
  const [x, z] = P.view.cellPos(fixedMirror.x, fixedMirror.y);
  const at = toScreen(x, z, 0.02);
  fire(cv.pointermove, at); frames(1);
  const r0 = fixedMirror.rot;
  fire(cv.wheel, { ...at, deltaY: -100 });
  ok(fixedMirror.rot === (r0 + 1) % 8, 'roda do mouse gira a peça presa');
  fire(cv.pointerdown, at); fire(win.pointerup, at);
  ok(fixedMirror.rot === r0, 'clique sem arrastar gira de volta (horário)');
  fire(cv.pointerdown, at); fire(cv.pointermove, { clientX: at.clientX + 40, clientY: at.clientY }); frames(1); fire(win.pointerup, at);
  ok(fixedMirror.x === 4 && fixedMirror.y === 1, 'peça presa não sai do lugar');
}
// Clique no painel: pausa → "Continuar"
P.togglePause();
{
  // botão "Continuar" fica em (262..762, 200..288) num canvas de 1024x800
  const pm = P.world.stage.children.find(o => o.renderOrder === 10);
  pm.updateMatrixWorld();
  const local = new THREE.Vector3((512 / 1024 - 0.5) * 0.8, (0.5 - 244 / 800) * 0.8 * 800 / 1024, 0);
  const v = pm.localToWorld(local).project(P.camera);
  const at = { clientX: (v.x + 1) / 2 * innerWidth, clientY: (1 - v.y) / 2 * innerHeight };
  fire(cv.pointermove, at); frames(1);
  fire(cv.pointerdown, at);
  ok(P.app === 'playing', 'clicar em "Continuar" no painel volta ao jogo');
}

// ---------- VR com controle falso: fase 1 ----------
dev.loadLevel(1);
{
  R.xr.isPresenting = true;
  (R.xrHandlers.sessionstart || []).forEach(f => f());
  const right = R.ctrls[1];
  const buttons = Array.from({ length: 6 }, () => ({ pressed: false }));
  const pulses = [];
  const source = { handedness: 'right', gamepad: { buttons, axes: [0, 0, 0, 0], hapticActuators: [{ pulse: (v, ms) => pulses.push(ms) }] } };
  right.ctrl.dispatchEvent({ type: 'connected', data: source });
  frames(6); // recentraliza
  const rig = right.ctrl.parent;
  // aponta o controle de cima e de trás para um ponto da bancada
  const aim = (lx, lz, roll = 0) => {
    const target = P.world.board.localToWorld(new THREE.Vector3(lx, 0.02, lz));
    const eye = target.clone().add(new THREE.Vector3(0.1, 0.35, 0.35));
    const m = new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    if (roll) q.premultiply(new THREE.Quaternion().setFromAxisAngle(target.clone().sub(eye).normalize(), roll));
    rig.updateMatrixWorld(true);
    const rigQ = rig.getWorldQuaternion(new THREE.Quaternion());
    right.ctrl.position.copy(rig.worldToLocal(eye.clone()));
    right.ctrl.quaternion.copy(rigQ.invert().multiply(q));
    right.grip.position.copy(right.ctrl.position);
    right.grip.quaternion.copy(right.ctrl.quaternion);
  };
  const mirror = P.puzzle.trayPieces[0];
  const [sx, sz] = P.view.slotPos(mirror.slot);
  const [cx, cz] = P.view.cellPos(3, 1);
  aim(sx, sz); frames(1);
  right.ctrl.dispatchEvent({ type: 'selectstart' });
  frames(1);
  aim(cx, cz); frames(2);
  aim(cx, cz, -Math.PI / 4); frames(2);   // gira o pulso 45°
  ok(mirror.rot === 1, `girar o pulso gira a peça segurada (rot ${mirror.rot})`);
  right.ctrl.dispatchEvent({ type: 'selectend' });
  frames(1);
  ok(mirror.x === 3 && mirror.y === 1, `controle leva o espelho até a casa (${mirror.x},${mirror.y})`);
  ok(P.app === 'winning', 'VR: cristal aceso, fase vencida');
  ok(pulses.length > 0, 'controle vibra');
  dev.advance(2);
  ok(P.app === 'won', 'VR: painel de vitória');
  // thumbstick gira a peça apontada
  dev.loadLevel(3);
  const fixedMirror = P.puzzle.pieces.find(p => p.type === 'mirror' && p.fixed);
  const [fx, fz] = P.view.cellPos(fixedMirror.x, fixedMirror.y);
  aim(fx, fz); frames(2);
  const r0 = fixedMirror.rot;
  buttons[3].pressed = true; frames(1); buttons[3].pressed = false; frames(1);
  ok(fixedMirror.rot === (r0 + 7) % 8, 'apertar o thumbstick gira 45° horário');
  buttons[5].pressed = true; frames(1); buttons[5].pressed = false; frames(1);
  ok(P.app === 'paused', 'B pausa no VR');
  R.xr.isPresenting = false;
  (R.xrHandlers.sessionend || []).forEach(f => f());
  frames(1);
}

console.log(`  main.js (sem navegador): ${count} verificações, ${R.renders} quadros desenhados`);
if (fails) console.log(`  ${fails} falharam`);
process.exit(fails ? 1 : 0);
