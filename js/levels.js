// As 20 fases, desenhadas como mapas de texto. Sem navegador nem Three.js.
//
// Cada linha do mapa é uma fileira da bancada; a primeira linha é a do fundo (longe do
// jogador). Casas separadas por espaço:
//   .        casa vazia                 #        bloqueador
//   R> G^ B< W v   emissor (cor + direção: > leste, ^ norte, < oeste, v sul,
//                  9 nordeste, 7 noroeste, 1 sudoeste, 3 sudeste — como no teclado numérico)
//   *R *Y *K  cristal (cor exigida; K = cristal escuro: nenhuma luz pode chegar nele)
//   / \ - |   espelho fixo (a linha desenhada é o espelho)
//   S/ S\ S- S|   divisor de feixe fixo
//   FR FG FB  filtro fixo
//   P> P9 ... prisma fixo (a direção é para onde a luz tem que entrar andando)
//   @ no fim  peça fixa que gira (ex.: /@, P>@, R>@)
// tray: peças da gaveta, móveis: M espelho, S divisor, FR/FG/FB filtro, P prisma.
import { COLOR, D } from './optics.js';

const ARROW = { '>': D.E, '9': D.NE, '^': D.N, '7': D.NW, '<': D.W, '1': D.SW, 'v': D.S, '3': D.SE };
const LINE = { '-': 0, '/': 1, '|': 2, '\\': 3 };

function parseCell(tok, x, y) {
  let turn = false;
  if (tok.endsWith('@')) { turn = true; tok = tok.slice(0, -1); }
  const c0 = tok[0], rest = tok.slice(1);
  if (tok === '.') return null;
  if (tok === '#') return { type: 'wall', x, y };
  if (tok.length === 1 && c0 in LINE) return { type: 'mirror', x, y, rot: LINE[c0], turn };
  if (c0 === '*' && rest in COLOR) return { type: 'crystal', x, y, color: COLOR[rest] };
  if (c0 === 'S' && rest in LINE) return { type: 'splitter', x, y, rot: LINE[rest], turn };
  if (c0 === 'F' && rest in COLOR) return { type: 'filter', x, y, color: COLOR[rest] };
  if (c0 === 'P' && rest in ARROW) return { type: 'prism', x, y, rot: ARROW[rest], turn };
  if (c0 in COLOR && rest in ARROW) return { type: 'emitter', x, y, color: COLOR[c0], rot: ARROW[rest], turn };
  throw new Error(`peça desconhecida "${tok}" em ${x},${y}`);
}

function parseTray(s) {
  return s.split(/\s+/).filter(Boolean).map(t => {
    if (t === 'M') return { type: 'mirror' };
    if (t === 'S') return { type: 'splitter' };
    if (t === 'P') return { type: 'prism' };
    if (t[0] === 'F' && t.slice(1) in COLOR) return { type: 'filter', color: COLOR[t.slice(1)] };
    throw new Error(`peça de gaveta desconhecida "${t}"`);
  });
}

function L(name, hint, map, tray) {
  const rows = map.map(r => r.trim().split(/\s+/));
  const h = rows.length, w = rows[0].length;
  const board = [];
  rows.forEach((row, i) => {
    if (row.length !== w) throw new Error(`fase "${name}": linha ${i + 1} com ${row.length} casas (esperado ${w})`);
    row.forEach((tok, x) => { const p = parseCell(tok, x, h - 1 - i); if (p) board.push(p); });
  });
  return { name, hint, w, h, board, tray: parseTray(tray) };
}

export const GROUPS = [
  { name: 'Espelhos', from: 0, to: 4 },
  { name: 'Divisores', from: 5, to: 9 },
  { name: 'Cores', from: 10, to: 14 },
  { name: 'Prisma', from: 15, to: 19 },
];

export const LEVELS = [
  // ---------- Espelhos ----------
  L('Primeiro reflexo', 'Pegue o espelho da gaveta e ponha no caminho do feixe. Gire para mandar a luz ao cristal.', [
    '.  .  .  *R .',
    '.  .  .  .  .',
    '.  .  .  .  .',
    'R> .  .  .  .',
    '.  .  .  .  .',
  ], 'M'),
  L('Dobrando a esquina', 'Dois espelhos levam a luz por cima da parede.', [
    '*R .  .  .  .  .',
    '.  .  .  .  .  .',
    '#  #  #  .  .  .',
    '.  .  .  .  .  .',
    'R> .  .  .  .  .',
    '.  .  .  .  .  .',
  ], 'M M'),
  L('Espelho preso', 'Peças com anel giram mas não saem do lugar. Gire o espelho preso.', [
    '.  .  .  .  .  .',
    '.  *R .  .  .  .',
    '.  .  .  .  .  .',
    '.  #  .  .  .  .',
    'R> .  .  .  \\@ .',
    '.  .  .  .  .  .',
  ], 'M'),
  L('Cristal escuro', 'O cristal escuro não pode receber luz nenhuma. Cuidado com o caminho dos dois feixes.', [
    '.  .  .  *G .  .',
    '.  *R .  .  .  .',
    'G> .  .  *K .  .',
    '.  .  .  .  .  .',
    '.  .  .  .  .  R<',
    '.  .  .  .  .  .',
  ], 'M M M'),
  L('Mestre dos espelhos', 'Fase mestre: dois feixes, pouco espaço e cristais escuros no caminho.', [
    '.  .  .  .  *B .  .',
    '.  #  .  .  .  .  *K',
    '.  .  .  #  .  .  .',
    'B> .  *K .  .  .  .',
    '.  .  .  .  /@ .  .',
    '.  .  #  .  .  .  *R',
    '.  .  .  R^ .  .  .',
  ], 'M M M'),

  // ---------- Divisores ----------
  L('Meio a meio', 'O divisor de feixe deixa metade da luz passar e reflete a outra metade.', [
    '.  .  *R .  .',
    '.  .  .  .  .',
    'R> .  .  .  *R',
    '.  .  .  .  .',
    '.  .  .  .  .',
  ], 'S'),
  L('Dois caminhos', 'Divida o feixe e leve cada metade a um cristal.', [
    '.  .  .  .  .  .',
    '*G .  .  .  .  .',
    '.  .  .  .  .  .',
    '.  .  .  #  .  *G',
    '.  .  .  .  .  .',
    '.  .  G^ .  .  .',
  ], 'S M M'),
  L('Divisor preso', 'O divisor preso gira. Ache o ângulo e complete com os espelhos.', [
    '.  .  .  .  .  .',
    '.  .  .  .  .  *B',
    '.  #  .  .  .  .',
    'B> .  .  S-@ .  .',
    '.  .  .  .  .  .',
    '*B .  .  .  #  *K',
  ], 'M M'),
  L('Três de uma vez', 'Um feixe só para três cristais: divida duas vezes.', [
    '.  .  .  *R .  .  .',
    '.  .  .  .  .  .  .',
    '.  .  .  .  .  .  .',
    'R> .  .  .  .  .  *R',
    '.  .  .  .  .  .  .',
    '.  .  .  .  .  .  .',
    '*R .  .  .  .  .  .',
  ], 'S S M'),
  L('Mestre dos divisores', 'Fase mestre: quatro cristais, dois escuros e só um emissor.', [
    '*G .  .  .  .  .  .',
    '.  .  #  .  .  *K .',
    '.  .  .  .  .  .  .',
    '.  .  .  .  .  .  *G',
    '#  .  .  .  .  .  .',
    '.  *K .  .  .  #  .',
    '.  .  .  G^ .  .  *G',
  ], 'S S M M'),

  // ---------- Cores ----------
  L('Amarelo', 'Luz soma: vermelho + verde = amarelo. Junte os dois feixes no mesmo cristal.', [
    '.  .  .  .  .  .',
    '.  .  .  *Y .  .',
    '.  .  .  .  .  .',
    'R> .  .  .  .  .',
    '.  .  .  .  .  .',
    '.  .  .  .  G^ .',
  ], 'M M'),
  L('Magenta', 'Vermelho + azul = magenta. Mas um cristal quer só vermelho.', [
    '.  .  .  .  .  .',
    '.  *M .  .  .  .',
    '.  .  .  .  .  *R',
    '.  .  .  .  .  .',
    'R> .  .  .  .  .',
    '.  .  .  B^ .  .',
  ], 'S M M'),
  L('Filtros', 'O filtro deixa passar só a sua cor. Separe o branco.', [
    '.  .  .  *R .  .',
    '.  .  .  .  .  .',
    'W> .  .  .  .  *B',
    '.  .  .  .  .  .',
    '.  .  .  .  .  .',
    '.  .  .  .  .  .',
  ], 'S FR FB'),
  L('Branco vira amarelo', 'Amarelo é branco sem o azul. Divida, filtre e junte de novo.', [
    '.  .  .  .  .  .',
    '.  .  .  .  .  .',
    '.  .  .  .  *Y .',
    '.  .  .  .  .  .',
    'W> .  .  .  .  .',
    '.  .  .  .  .  .',
  ], 'S FR FG M M'),
  L('Mestre das cores', 'Fase mestre: três emissores, um cristal branco e um ciano.', [
    '.  .  .  *C .  B<',
    '.  .  .  .  .  .',
    'R> .  .  *W .  .',
    '.  .  #  .  .  *K',
    '.  .  .  .  .  .',
    '.  G^ .  .  .  .',
  ], 'S S M M M'),
  // ---------- Prisma ----------
  L('Arco-íris', 'O prisma separa o branco: vermelho vira à esquerda, verde segue, azul vira à direita.', [
    '.  .  .  .  *R',
    '.  .  .  .  .',
    'W> .  .  .  *G',
    '.  .  .  .  .',
    '.  .  .  .  *B',
  ], 'P'),
  L('Luz na diagonal', 'Espelhos também refletem a luz que anda na diagonal.', [
    '.  .  .  .  .  .',
    '.  .  .  .  .  *R',
    '.  .  .  .  .  .',
    'W> .  .  .  .  *G',
    '.  .  .  .  .  .',
    '.  *B .  .  .  .',
  ], 'P M M'),
  L('Curva vermelha', 'O prisma também entorta uma cor sozinha. Leve o vermelho pela diagonal.', [
    '.  .  *R .  .  .',
    '.  .  #  .  .  .',
    '.  .  .  .  .  .',
    '.  .  .  .  .  .',
    '.  .  .  .  .  .',
    'R> .  .  .  .  *K',
  ], 'P M'),
  L('Magenta do prisma', 'Separe o branco e junte vermelho e azul de novo. O verde não pode chegar no escuro.', [
    '.  .  .  .  .  .  .',
    '.  .  .  .  .  .  .',
    '.  .  .  .  .  .  .',
    'W> .  .  .  .  .  *K',
    '.  .  .  .  .  .  .',
    '.  .  .  *M .  .  .',
    '.  .  .  .  .  .  .',
  ], 'P M M'),
  L('Grande final', 'Fase mestre: prisma, divisor e filtro juntos. Todos os cristais ao mesmo tempo.', [
    '.  Wv .  .  .  .  .',
    '.  .  .  .  .  .  .',
    '.  .  .  .  *Y .  .',
    '.  .  .  .  .  .  .',
    'W> .  .  .  .  .  *C',
    '.  .  .  .  .  .  .',
    '.  *R .  .  .  .  *K',
  ], 'P S M FR'),
];
