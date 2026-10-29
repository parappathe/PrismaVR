// Robô que resolve qualquer fase por busca: prova que todas têm solução e serve para o
// dev.solve() no navegador. Sem navegador nem Three.js.
//
// Ideia: numa solução, a primeira peça da gaveta que a luz alcança está numa casa por onde o
// feixe já passa sem ela. Então basta tentar colocar peças só nas casas vazias que os feixes
// atravessam agora, uma de cada vez (busca em profundidade com aprofundamento iterativo, para
// achar a solução com o menor número de peças). Peças iguais da gaveta são trocáveis entre si.
import { trace, ROT_STATES, DIRS } from './optics.js';
import { Puzzle, canTurn } from './puzzle.js';

const rotStates = (p) => (canTurn(p) ? ROT_STATES[p.type] : 1);

export function solve(def, { maxNodes = 4e6, countAll = false } = {}) {
  const pz = new Puzzle(def);
  const { w, h } = pz;
  const turnable = pz.pieces.filter(p => p.fixed && canTurn(p));
  const tray = pz.trayPieces;
  const sigs = [...new Set(tray.map(p => `${p.type}:${p.color}`))];
  const sig = tray.map(p => sigs.indexOf(`${p.type}:${p.color}`));
  const cells = pz.cells();
  // Hash de Zobrist (dois números de 26 bits) para não visitar o mesmo conjunto de peças
  // duas vezes em ordens diferentes.
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed & 0x3ffffff; };
  const zSize = sigs.length * w * h * 8;
  const zHi = new Int32Array(zSize).map(rnd), zLo = new Int32Array(zSize).map(rnd);
  const zIndex = (si, ni, rot) => (si * w * h + ni) * 8 + rot;
  let nodes = 0;
  let found = null, count = 0;
  let visited;

  function search(limit, placed, used, hi, lo) {
    if (++nodes > maxNodes) throw new Error('limite de busca');
    const res = trace(w, h, cells);
    if (res.won) {
      count++;
      if (!found) found = { rots: turnable.map(p => p.rot), placed: placed.slice() };
      return !countAll;
    }
    if (placed.length >= limit) return false;
    const cand = [];
    const mark = new Uint8Array(w * h);
    for (const s of res.segs) {
      if (s.out) continue;
      const ni = s.x + DIRS[s.d][0] + (s.y + DIRS[s.d][1]) * w;
      if (!cells[ni] && !mark[ni]) { mark[ni] = 1; cand.push(ni); }
    }
    const tried = new Uint8Array(sigs.length);
    for (let i = 0; i < tray.length; i++) {
      if (used[i] || tried[sig[i]]) continue;
      tried[sig[i]] = 1;   // peças iguais: tenta só a primeira livre
      const t = tray[i], states = ROT_STATES[t.type];
      for (const ni of cand) {
        for (let rot = 0; rot < states; rot++) {
          const z = zIndex(sig[i], ni, rot);
          const nh = hi ^ zHi[z], nl = lo ^ zLo[z];
          const key = nh * 67108864 + nl;
          if (visited.has(key)) continue;
          visited.add(key);
          const a = { i, x: ni % w, y: Math.floor(ni / w), rot };
          cells[ni] = { ...t, x: a.x, y: a.y, rot };
          used[i] = true; placed.push(a);
          const done = search(limit, placed, used, nh, nl);
          placed.pop(); used[i] = false; cells[ni] = null;
          if (done) return true;
        }
      }
    }
    return false;
  }

  for (let limit = 0; limit <= tray.length; limit++) {
    // todas as combinações de giro das peças fixas giratórias
    const combo = (k) => {
      if (k === turnable.length) {
        visited = new Set();
        return search(limit, [], new Array(tray.length).fill(false), 0, 0);
      }
      const p = turnable[k];
      for (let r = 0; r < rotStates(p); r++) {
        p.rot = r;
        if (combo(k + 1)) return true;
      }
      return false;
    };
    combo(0);
    if (found) {
      const actions = [];
      turnable.forEach((p, k) => actions.push({ kind: 'turn', index: pz.pieces.indexOf(p), rot: found.rots[k] }));
      for (const a of found.placed) actions.push({ kind: 'place', index: pz.pieces.indexOf(tray[a.i]), x: a.x, y: a.y, rot: a.rot });
      return { actions, pieces: limit, nodes, solutions: count };
    }
  }
  return null;
}

// Aplica a solução numa partida como um jogador faria (colocar e girar pelas regras).
// Peças são achadas pela posição na lista (a ordem é sempre a mesma para a mesma fase).
export function applySolution(puzzle, sol) {
  for (const p of puzzle.trayPieces) puzzle.toTray(p);
  for (const a of sol.actions) {
    const p = puzzle.pieces[a.index];
    if (a.kind === 'place' && !puzzle.place(p, a.x, a.y)) return false;
    let guard = 0;
    while (p.rot !== a.rot && guard++ < 8) puzzle.rotate(p, 1);
    if (p.rot !== a.rot) return false;
  }
  return puzzle.won;
}
