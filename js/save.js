// Progresso e opções, salvos no navegador.
const KEY = 'prismavr.v1';
const DEFAULTS = {
  done: {},        // fases vencidas: { 0: { moves: 6, time: 31.5 }, ... }
  hum: true,       // zumbido dos feixes
  fps: false,
};

export function loadSave() {
  try {
    const s = JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...s, done: { ...(s.done || {}) } };
  } catch { return { ...DEFAULTS, done: {} }; }
}

export function storeSave(s) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento: segue sem salvar */ }
}

// Primeira fase ainda não vencida (as anteriores liberam a próxima).
export function unlockedUpTo(save, count) {
  let n = 0;
  while (n < count && save.done[n]) n++;
  return Math.min(n, count - 1);
}

// Guarda a vitória mantendo o melhor (menos movimentos, menor tempo).
export function recordWin(save, i, moves, time) {
  const prev = save.done[i];
  save.done[i] = {
    moves: Math.min(moves, prev?.moves ?? Infinity),
    time: Math.min(time, prev?.time ?? Infinity),
  };
}
