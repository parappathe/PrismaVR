// Óptica da bancada: grade 2D, 8 direções (passos de 45°) e cores aditivas em 3 bits.
// Sem navegador nem Three.js: os testes rodam no Node.

// Cores: um bit por componente. Somar luz = OU dos bits.
export const R = 1, G = 2, B = 4;
export const COLOR = { K: 0, R: 1, G: 2, Y: 3, B: 4, M: 5, C: 6, W: 7 };
export const COLOR_NAME = ['apagado', 'vermelho', 'verde', 'amarelo', 'azul', 'magenta', 'ciano', 'branco'];
export const COLOR_HEX = [0x222230, 0xff3344, 0x33ff66, 0xffee33, 0x3377ff, 0xff33ee, 0x33f0ff, 0xffffff];
export const COMPONENTS = [R, G, B];

// Direções em ordem anti-horária (vista de cima): 0 = leste (direita), 2 = norte (para longe
// do jogador), 4 = oeste, 6 = sul. Ímpares são diagonais.
export const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export const D = { E: 0, NE: 1, N: 2, NW: 3, W: 4, SW: 5, S: 6, SE: 7 };
export const mod8 = (d) => ((d % 8) + 8) % 8;

// Espelho com a linha em m·45° (m = rot % 4): reflete d em 2m − d. Feixe paralelo à linha
// passa direto (a fórmula já dá isso); perpendicular volta pelo mesmo caminho.
export const reflect = (rot, d) => mod8(2 * (rot % 4) - d);

// Prisma: só aceita luz andando na direção rot (entrando pela face de trás). Vermelho sai
// virado 45° para a esquerda, verde segue reto, azul vira 45° para a direita.
export const PRISM_TURN = { [R]: 1, [G]: 0, [B]: -1 };

// Quais peças têm orientação e quantos estados diferentes ela tem.
export const ROT_STATES = { mirror: 4, splitter: 4, prism: 8, emitter: 8, filter: 1, wall: 1, crystal: 1 };

// Traça os feixes. cells: vetor w*h com a peça de cada casa (ou null); índice x + y*w.
// Cada componente de cor é traçado separado (as peças agem em cada um de forma independente),
// com estados já visitados marcados para laços de espelhos não travarem.
// Devolve os trechos de feixe (de casa a casa, com a cor somada), o que cada casa recebeu e
// o estado dos cristais.
export function trace(w, h, cells) {
  const got = new Uint8Array(w * h);
  const segColor = new Uint8Array(w * h * 8);  // chave (x + y*w)*8 + d → cor somada
  const segOut = new Uint8Array(w * h * 8);    // 1 = trecho que sai da bancada
  const stack = [];
  for (const c of COMPONENTS) {
    for (let i = 0; i < cells.length; i++) {
      const p = cells[i];
      if (p && p.type === 'emitter' && (p.color & c)) stack.push(i % w, Math.floor(i / w), p.rot);
    }
    while (stack.length) {
      const d = stack.pop(), y = stack.pop(), x = stack.pop();
      const key = (x + y * w) * 8 + d;
      if (segColor[key] & c) continue;
      segColor[key] |= c;
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { segOut[key] = 1; continue; }
      const ni = nx + ny * w;
      const p = cells[ni];
      if (!p) { stack.push(nx, ny, d); continue; }
      switch (p.type) {
        case 'mirror': stack.push(nx, ny, reflect(p.rot, d)); break;
        case 'splitter': {
          const r = reflect(p.rot, d);
          stack.push(nx, ny, d);
          if (r !== d) stack.push(nx, ny, r);
          break;
        }
        case 'filter': if (p.color & c) stack.push(nx, ny, d); break;
        case 'prism': if (d === p.rot) stack.push(nx, ny, mod8(d + PRISM_TURN[c])); break;
        case 'crystal': got[ni] |= c; break;
        default: break; // parede, emissor: o feixe para
      }
    }
  }
  const segs = [];
  for (let key = 0; key < segColor.length; key++) {
    const color = segColor[key];
    if (!color) continue;
    const cell = key >> 3, d = key & 7;
    segs.push({ x: cell % w, y: Math.floor(cell / w), d, color, out: segOut[key] === 1 });
  }
  const crystals = [];
  let lit = 0, need = 0, alarm = false;
  for (let i = 0; i < cells.length; i++) {
    const p = cells[i];
    if (!p || p.type !== 'crystal') continue;
    const ok = got[i] === p.color;
    crystals.push({ x: i % w, y: Math.floor(i / w), piece: p, got: got[i], ok });
    if (p.color) { need++; if (ok) lit++; } else if (!ok) alarm = true;
  }
  return { segs, got, crystals, lit, need, alarm, won: need > 0 && lit === need && !alarm };
}

// Junta trechos seguidos na mesma direção e cor (menos peças para desenhar).
// Devolve raios { x0, y0, x1, y1, color } em coordenadas de casa (centro da casa = inteiro).
export function mergeSegs(segs, w) {
  const byKey = new Map();
  for (const s of segs) byKey.set((s.x + s.y * w) * 8 + s.d, s);
  const out = [];
  for (const s of segs) {
    const [dx, dy] = DIRS[s.d];
    const px = s.x - dx, py = s.y - dy;
    const prev = byKey.get((px + py * w) * 8 + s.d);
    if (prev && prev.color === s.color && !prev.out && px >= 0 && py >= 0 && px < w) continue; // não é o começo
    let cur = s, len = 0;
    for (;;) {
      len++;
      if (cur.out) break;
      const nx = cur.x + dx, ny = cur.y + dy;
      const next = byKey.get((nx + ny * w) * 8 + s.d);
      if (!next || next.color !== s.color || nx >= w) break;
      cur = next;
    }
    const last = cur.out ? len - 0.5 : len;
    out.push({ x0: s.x, y0: s.y, x1: s.x + dx * last, y1: s.y + dy * last, color: s.color, d: s.d });
  }
  return out;
}
