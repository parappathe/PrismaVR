// Jogador robô: acha a solução pela busca de js/solver.js e joga a fase pelas mesmas regras
// do jogador (tirar da gaveta, pôr na casa, girar de 45 em 45 graus).
import { Puzzle } from '../js/puzzle.js';
import { solve, applySolution } from '../js/solver.js';

export function robotPlay(def) {
  const sol = solve(def);
  if (!sol) return { won: false, sol: null, puzzle: null };
  const puzzle = new Puzzle(def);
  const won = applySolution(puzzle, sol);
  return { won, sol, puzzle };
}
