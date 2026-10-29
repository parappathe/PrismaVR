// Testes automáticos: node tests/run.js  (tem que terminar com "Tudo certo"). Não toca som.
import { trace, mergeSegs, reflect, mod8, COLOR, D, R, G, B, ROT_STATES } from '../js/optics.js';
import { Puzzle, canTurn } from '../js/puzzle.js';
import { LEVELS, GROUPS } from '../js/levels.js';
import { loadSave, storeSave, unlockedUpTo, recordWin } from '../js/save.js';
import { robotPlay } from './robot.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let fails = 0, count = 0;
function ok(cond, msg) { count++; if (!cond) { fails++; console.log('  FALHOU: ' + msg); } }

// Monta uma grade de teste a partir de peças soltas.
function grid(w, h, pieces) {
  const c = new Array(w * h).fill(null);
  for (const p of pieces) c[p.x + p.y * w] = { rot: 0, color: 0, ...p };
  return c;
}
const em = (x, y, rot, color) => ({ type: 'emitter', x, y, rot, color });
const cr = (x, y, color) => ({ type: 'crystal', x, y, color });

console.log('Óptica');
{
  ok(reflect(1, D.E) === D.N && reflect(3, D.E) === D.S, 'espelho / manda leste para norte, \\ para sul');
  ok(reflect(0, D.E) === D.E && reflect(2, D.N) === D.N, 'feixe paralelo ao espelho passa');
  ok(reflect(2, D.E) === D.W && reflect(0, D.N) === D.S, 'espelho perpendicular devolve o feixe');
  ok(reflect(0, D.NE) === D.SE && reflect(2, D.NE) === D.NW, 'espelho reto reflete diagonal em 90°');
  ok(reflect(5, D.E) === reflect(1, D.E), 'espelho girado 180° é o mesmo espelho');
  ok(mod8(-1) === 7 && mod8(9) === 1, 'direção dá a volta');

  // Feixe direto acende o cristal da mesma cor; cor errada não acende.
  let r = trace(5, 1, grid(5, 1, [em(0, 0, D.E, R), cr(4, 0, R)]));
  ok(r.won && r.lit === 1, 'vermelho direto no cristal vermelho');
  r = trace(5, 1, grid(5, 1, [em(0, 0, D.E, G), cr(4, 0, R)]));
  ok(!r.won && r.crystals[0].got === G, 'verde no cristal vermelho não acende');
  // Espelho em L
  r = trace(4, 4, grid(4, 4, [em(0, 0, D.E, R), { type: 'mirror', x: 3, y: 0, rot: 1 }, cr(3, 3, R)]));
  ok(r.won, 'espelho / leva o feixe para cima');
  // Soma de cores: vermelho de um lado, verde de outro = amarelo
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, R), em(2, 0, D.N, G), cr(2, 2, COLOR.Y)]));
  ok(r.won && r.crystals[0].got === COLOR.Y, 'vermelho + verde = amarelo');
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, R), cr(2, 2, COLOR.Y)]));
  ok(!r.won, 'só vermelho não acende o amarelo');
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, COLOR.W), em(2, 0, D.N, G), cr(2, 2, COLOR.Y)]));
  ok(!r.won && r.crystals[0].got === COLOR.W, 'branco + verde dá branco, não amarelo (soma exata)');
  // Cristal escuro
  r = trace(5, 1, grid(5, 1, [em(0, 0, D.E, R), cr(2, 0, COLOR.K), cr(4, 0, R)]));
  ok(!r.won && r.alarm && r.lit === 0, 'cristal escuro no caminho: alarme e o outro não recebe');
  r = trace(5, 2, grid(5, 2, [em(0, 0, D.E, R), cr(2, 1, COLOR.K), cr(4, 0, R)]));
  ok(r.won && !r.alarm, 'cristal escuro fora do caminho não atrapalha');
  ok(!trace(3, 1, grid(3, 1, [cr(1, 0, COLOR.K)])).won, 'fase só com cristal escuro não é vitória');
  // Divisor: passa e reflete
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, B), { type: 'splitter', x: 2, y: 2, rot: 1 }, cr(4, 2, B), cr(2, 4, B)]));
  ok(r.won && r.lit === 2, 'divisor acende dois cristais');
  // Filtro
  r = trace(5, 1, grid(5, 1, [em(0, 0, D.E, COLOR.W), { type: 'filter', x: 2, y: 0, color: G }, cr(4, 0, G)]));
  ok(r.won, 'filtro verde tira vermelho e azul do branco');
  r = trace(5, 1, grid(5, 1, [em(0, 0, D.E, R), { type: 'filter', x: 2, y: 0, color: G }, cr(4, 0, COLOR.K)]));
  ok(r.won === false && !r.alarm && r.crystals[0].got === 0, 'filtro verde bloqueia vermelho');
  // Prisma: vermelho à esquerda (NE), verde reto, azul à direita (SE)
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, COLOR.W), { type: 'prism', x: 2, y: 2, rot: D.E }, cr(4, 4, R), cr(4, 2, G), cr(4, 0, B)]));
  ok(r.won && r.lit === 3, 'prisma separa o branco em três');
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, COLOR.W), { type: 'prism', x: 2, y: 2, rot: D.W }, cr(4, 2, COLOR.W)]));
  ok(!r.won && r.crystals[0].got === 0, 'prisma virado ao contrário bloqueia');
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, R), { type: 'prism', x: 2, y: 2, rot: D.E }, cr(4, 4, R)]));
  ok(r.won, 'prisma entorta o vermelho sozinho');
  // Bloqueador e borda
  r = trace(5, 1, grid(5, 1, [em(0, 0, D.E, R), { type: 'wall', x: 2, y: 0 }, cr(4, 0, R)]));
  ok(!r.won && r.segs.length === 2, 'bloqueador para o feixe');
  r = trace(3, 1, grid(3, 1, [em(0, 0, D.E, R)]));
  ok(r.segs.some(s => s.out) && r.segs.length === 3, 'feixe sai pela borda');
  // Laço de espelhos não trava
  const loop = grid(4, 4, [em(0, 0, D.E, R), { type: 'splitter', x: 1, y: 0, rot: 1 }, { type: 'mirror', x: 1, y: 3, rot: 3 },
    { type: 'mirror', x: 0, y: 3, rot: 1 }, { type: 'mirror', x: 0, y: 1, rot: 1 }]);
  r = trace(4, 4, loop);
  ok(r.segs.length < 4 * 4 * 8, 'laço de espelhos termina');
  // Juntar trechos para desenhar
  r = trace(6, 1, grid(6, 1, [em(0, 0, D.E, R)]));
  const m = mergeSegs(r.segs, 6);
  ok(m.length === 1 && m[0].x0 === 0 && m[0].x1 === 5.5, `trechos seguidos viram um raio (${JSON.stringify(m)})`);
  r = trace(5, 5, grid(5, 5, [em(0, 2, D.E, COLOR.W), { type: 'prism', x: 2, y: 2, rot: D.E }]));
  ok(mergeSegs(r.segs, 5).length === 4, 'branco até o prisma + três cores saindo = 4 raios');
}

console.log('Peças e regras');
{
  const def = LEVELS[0];
  const pz = new Puzzle(def);
  const mirror = pz.trayPieces[0];
  const fixedE = pz.pieces.find(p => p.type === 'emitter');
  ok(!pz.won, 'fase 1 começa sem vitória');
  ok(!pz.place(fixedE, 2, 2), 'peça fixa não sai do lugar');
  ok(!pz.rotate(fixedE, 1), 'emissor fixo sem anel não gira');
  ok(!pz.place(mirror, fixedE.x, fixedE.y), 'não pode pôr peça em casa ocupada');
  ok(!pz.place(mirror, 9, 9), 'não pode pôr fora da bancada');
  ok(pz.place(mirror, 3, 1) && pz.pieceAt(3, 1) === mirror, 'põe o espelho na casa');
  ok(!pz.won, 'espelho reto ainda não acende');
  pz.rotate(mirror, 1);
  ok(pz.won, 'girando 45° acende o cristal');
  const pv = pz.trace({ piece: mirror, x: 2, y: 1, rot: 1 });
  ok(!pv.won && pz.won && mirror.x === 3, 'prévia do arrasto não mexe no estado');
  ok(pz.toTray(mirror) && !pz.won && mirror.x === -1, 'voltar para a gaveta apaga');
  ok(pz.moves === 3, `conta movimentos (${pz.moves})`);
  pz.place(mirror, 3, 1); pz.reset();
  ok(pz.trayPieces.every(p => p.x === -1) && !pz.won, 'recomeçar devolve tudo à gaveta');
  ok(canTurn({ type: 'mirror', fixed: true, turn: true }) && !canTurn({ type: 'mirror', fixed: true, turn: false }), 'anel de giro em peça fixa');
  ok(!canTurn({ type: 'filter', fixed: false }), 'filtro não tem lado (não gira)');
}

console.log('Progresso salvo');
{
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const s = loadSave();
  ok(unlockedUpTo(s, LEVELS.length) === 0, 'começa só com a fase 1');
  recordWin(s, 0, 5, 20); recordWin(s, 0, 7, 12);
  ok(s.done[0].moves === 5 && s.done[0].time === 12, 'guarda o melhor movimento e o melhor tempo');
  recordWin(s, 1, 3, 9);
  storeSave(s);
  const s2 = loadSave();
  ok(unlockedUpTo(s2, LEVELS.length) === 2 && s2.hum === true, 'vencer libera a próxima e salva');
  recordWin(s2, 3, 3, 9);
  ok(unlockedUpTo(s2, LEVELS.length) === 2, 'pular fase não libera além da primeira não vencida');
  store['prismavr.v1'] = '{quebrado';
  ok(Object.keys(loadSave().done).length === 0, 'save corrompido volta ao começo');
  delete globalThis.localStorage;
}

console.log('Fases');
{
  ok(LEVELS.length === 20, `20 fases (${LEVELS.length})`);
  ok(GROUPS.length === 4 && GROUPS.every(g => g.to - g.from === 4), '4 grupos de 5');
  const names = new Set();
  let totalNodes = 0;
  const t0 = Date.now();
  LEVELS.forEach((def, i) => {
    const tag = `fase ${i + 1} (${def.name})`;
    names.add(def.name);
    ok(def.w >= 5 && def.h >= 5 && def.w <= 9 && def.h <= 9, `${tag}: tamanho ${def.w}x${def.h}`);
    ok(def.hint && def.hint.length > 10, `${tag}: tem dica`);
    const pz = new Puzzle(def);
    const res = pz.trace();
    ok(res.need > 0, `${tag}: tem cristal para acender`);
    ok(pz.pieces.some(p => p.type === 'emitter'), `${tag}: tem emissor`);
    ok(!res.won, `${tag}: não começa vencida`);
    ok(def.tray.length >= 1 && def.tray.length <= 6, `${tag}: gaveta com 1 a 6 peças`);
    const t = Date.now();
    const { won, sol, puzzle } = robotPlay(def);
    ok(won, `${tag}: o robô resolve`);
    if (!sol) return;
    totalNodes += sol.nodes;
    // Cada peça que o robô usou é necessária: tirar qualquer uma apaga a vitória.
    for (const a of sol.actions.filter(x => x.kind === 'place')) {
      const p = puzzle.pieces[a.index];
      puzzle.toTray(p);
      ok(!puzzle.won, `${tag}: sem a peça em ${a.x},${a.y} não vence`);
      puzzle.place(p, a.x, a.y);
    }
    ok(puzzle.won, `${tag}: voltar a peça vence de novo`);
    // fase mestre (última de cada grupo) usa mais peças que a primeira do grupo
    const g = GROUPS.find(gr => i >= gr.from && i <= gr.to);
    if (i === g.to) ok(sol.pieces > robotPlay(LEVELS[g.from]).sol.pieces, `${tag}: mestre é mais difícil que a primeira do grupo`);
    console.log(`  ${String(i + 1).padStart(2)} ${def.name.padEnd(22)} ${def.w}x${def.h}  ${sol.pieces} peça(s) da gaveta  ${String(sol.nodes).padStart(8)} nós  ${Date.now() - t} ms`);
  });
  ok(names.size === LEVELS.length, 'nomes de fase diferentes');
  ok(Object.keys(ROT_STATES).length === 7, 'todas as peças com estados de giro');
  console.log(`  robô: ${totalNodes} posições testadas em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

console.log('Jogo inteiro (main.js) com navegador e controle de VR falsos');
{
  const root = fileURLToPath(new URL('..', import.meta.url));
  const r = spawnSync(process.execPath, ['--import', './tests/smoke/register.js', 'tests/smoke/main.js'], { cwd: root, stdio: 'inherit' });
  ok(r.status === 0, 'teste do main.js (tests/smoke/main.js)');
}

console.log(fails ? `\n${fails} de ${count} verificações falharam.` : `\nTudo certo (${count} verificações).`);
process.exit(fails ? 1 : 0);
