// Uma fase em jogo: peças na bancada e na gaveta, mover, girar e conferir a vitória.
// Sem navegador nem Three.js.
import { trace, ROT_STATES, mod8 } from './optics.js';

let nextId = 1;

export function canTurn(p) {
  if (ROT_STATES[p.type] <= 1) return false;
  return p.fixed ? !!p.turn : true;
}

export class Puzzle {
  constructor(def) {
    this.def = def;
    this.w = def.w; this.h = def.h;
    this.reset();
  }

  reset() {
    this.pieces = [];
    for (const b of this.def.board) {
      this.pieces.push({ id: nextId++, type: b.type, x: b.x, y: b.y, rot: b.rot || 0, color: b.color ?? 0, fixed: true, turn: !!b.turn, slot: -1 });
    }
    this.def.tray.forEach((t, i) => {
      this.pieces.push({ id: nextId++, type: t.type, x: -1, y: -1, rot: t.rot || 0, color: t.color ?? 0, fixed: false, turn: true, slot: i });
    });
    this.moves = 0;
    this.dirty = true;
    this._res = null;
  }

  get trayPieces() { return this.pieces.filter(p => !p.fixed); }
  onBoard(p) { return p.x >= 0; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  pieceAt(x, y) { return this.pieces.find(p => p.x === x && p.y === y) || null; }
  isFree(x, y, except = null) {
    if (!this.inside(x, y)) return false;
    const p = this.pieceAt(x, y);
    return !p || p === except;
  }

  // Coloca uma peça móvel numa casa vazia (vale tirar de outra casa ou da gaveta).
  place(p, x, y) {
    if (p.fixed || !this.isFree(x, y, p)) return false;
    if (p.x === x && p.y === y) return true;
    p.x = x; p.y = y;
    this.moves++;
    this.dirty = true;
    return true;
  }

  toTray(p) {
    if (p.fixed || p.x < 0) return false;
    p.x = p.y = -1;
    this.moves++;
    this.dirty = true;
    return true;
  }

  // Gira steps × 45° (positivo = anti-horário visto de cima).
  rotate(p, steps = 1) {
    if (!canTurn(p) || !steps) return false;
    p.rot = mod8(p.rot + steps);
    this.moves++;
    this.dirty = true;
    return true;
  }

  setRot(p, rot) {
    if (!canTurn(p) || mod8(rot) === p.rot) return false;
    p.rot = mod8(rot);
    this.moves++;
    this.dirty = true;
    return true;
  }

  // Vetor de casas. preview = { piece, x, y, rot } põe uma peça segurada numa casa sem mexer
  // no estado (para mostrar os feixes enquanto o jogador arrasta).
  cells(preview = null) {
    const c = new Array(this.w * this.h).fill(null);
    for (const p of this.pieces) {
      if (preview && p === preview.piece) continue;
      if (p.x >= 0) c[p.x + p.y * this.w] = p;
    }
    if (preview && this.inside(preview.x, preview.y) && !c[preview.x + preview.y * this.w]) {
      const p = preview.piece;
      c[preview.x + preview.y * this.w] = { ...p, x: preview.x, y: preview.y, rot: preview.rot ?? p.rot };
    }
    return c;
  }

  trace(preview = null) {
    if (preview) return trace(this.w, this.h, this.cells(preview));
    if (this.dirty || !this._res) { this._res = trace(this.w, this.h, this.cells()); this.dirty = false; }
    return this._res;
  }

  get won() { return this.trace().won; }

  // Estado das peças em texto (para salvar, comparar e para o robô).
  snapshot() { return this.pieces.map(p => `${p.x},${p.y},${p.rot}`).join(';'); }
}
