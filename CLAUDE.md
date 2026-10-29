# PrismaVR

Prisma: quebra-cabeça de luz e cor em VR para o Meta Quest 3, no navegador do óculos (WebXR),
sem instalar nada. Numa bancada escura de laboratório neon, emissores soltam feixes vermelhos,
verdes, azuis ou brancos; o jogador pega e gira espelhos, divisores, filtros e prismas para
acender cristais. As cores somam (vermelho + verde = amarelo, vermelho + azul = magenta,
verde + azul = ciano, os três = branco) e cada cristal só acende com a soma exata da sua cor.
20 fases em 4 grupos. Também joga no PC com o mouse. Tudo em português.

## Como rodar / jogar

**No Quest:** abrir no navegador do óculos **https://parappathe.github.io/PrismaVR/** (ou a
página inicial https://parappathe.github.io/) e apertar "Entrar em VR". Para atualizar o site:
commitar e rodar `python publicar.py PrismaVR` na pasta `C:\claude code`.

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8801` (o painel de
visualização usa `.claude/launch.json`). O `serve.py` manda o navegador não guardar cache;
`python serve.py --https` serve para abrir no Quest pela rede de casa.

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Pegar e mover peça | Gatilho ou botão lateral apontando para a peça (raio) ou encostando a mão nela; leve até a casa e solte | Clicar e arrastar |
| Girar 45° | Segurando a peça, gire o pulso; ou aperte o thumbstick (horário), A/X (anti-horário) ou incline o thumbstick para o lado, apontando para a peça | Clique sem arrastar ou botão direito (horário), roda do mouse, R (Shift+R ao contrário) |
| Tirar da bancada | Soltar sobre a gaveta (ou fora da grade) | Arrastar para a gaveta (ou para fora) |
| Pausa | B ou Y, ou apontar para a placa "Pausa" na bancada | Esc ou P |
| Menu | Apontar e gatilho | Clique |
| FPS | Menu principal → FPS | Tecla F |

Só com as mãos (sem controles): pinça apontando para a peça pega, girar o pulso gira.
Anel **dourado** na base = peça que se move; anel **azul** = peça presa que só gira; sem anel =
fixa. "Recentralizar" (na pausa) põe o jogador de frente para a bancada e ajusta a altura dela à
da cabeça. Vibração: ao pegar, soltar, a cada 45° do pulso, ao acender cristal e no alarme.

### Regras

- Grade 2D sobre a bancada (5x5 a 7x7), feixes andam de casa em casa em 8 direções (45°).
- **Espelho**: reflete (dos dois lados); feixe paralelo passa direto, perpendicular volta.
- **Divisor de feixe**: metade passa reto, metade reflete como o espelho.
- **Filtro** (vermelho, verde ou azul): só deixa passar o seu componente; não tem lado.
- **Prisma**: só aceita luz que entra pela face de trás (a setinha mostra o sentido). Vermelho
  sai 45° à esquerda, verde reto, azul 45° à direita; uma cor sozinha também é entortada.
- **Bloqueador** (listrado) e emissores param o feixe. **Cristal** absorve tudo que chega e
  soma as cores de todos os lados. **Cristal escuro**: não pode receber luz nenhuma.
- Vence quando todos os cristais coloridos estão acesos ao mesmo tempo e nenhum escuro recebe
  luz. Enquanto arrasta, os feixes já mostram como fica com a peça naquela casa.

Fases (em `js/levels.js`), a última de cada grupo é mestre:
- **Espelhos:** 1 Primeiro reflexo, 2 Dobrando a esquina, 3 Espelho preso, 4 Cristal escuro,
  5 Mestre dos espelhos.
- **Divisores:** 6 Meio a meio, 7 Dois caminhos, 8 Divisor preso, 9 Três de uma vez,
  10 Mestre dos divisores.
- **Cores:** 11 Amarelo, 12 Magenta, 13 Filtros, 14 Branco vira amarelo, 15 Mestre das cores.
- **Prisma:** 16 Arco-íris, 17 Luz na diagonal, 18 Curva vermelha, 19 Magenta do prisma,
  20 Grande final.

Vencer uma libera a próxima. Progresso salvo no navegador (localStorage, chave `prismavr.v1`):
fases vencidas com o melhor número de movimentos e o melhor tempo, e as opções (zumbido, FPS).
Atrás do menu principal fica a fase Arco-íris resolvida, de vitrine.

## Como testar

- `node tests/run.js` (ou `npm test`): óptica (reflexão, divisor, filtro, prisma, soma de
  cores, cristal escuro, laços de espelho, borda), regras das peças (fixa, giratória, gaveta,
  prévia do arrasto), progresso salvo e, para cada fase: não começa vencida e o robô
  (`tests/robot.js` + `js/solver.js`) resolve com o mínimo de peças, e cada peça que ele usou é
  necessária. Depois roda o `main.js` inteiro no Node com navegador e renderer falsos
  (`tests/smoke/`): menu, as 20 fases pelo `dev.solve()`, arrastar e girar com o mouse, Esc,
  clique no painel e um controle de VR falso (pegar, girar o pulso, thumbstick, B). Tem que
  terminar com "Tudo certo". Não toca som.
- No navegador (console), objeto `prisma`:
  `prisma.dev.loadLevel(5)` abre a fase 5 (1 a 20, mesmo bloqueada), `prisma.dev.solve()` o robô
  resolve a fase aberta, `prisma.dev.advance(2)` roda 2 s de jogo de uma vez (o painel de
  vitória aparece 1,6 s depois de acender tudo), `prisma.dev.state()` resume a fase,
  `prisma.dev.unlockAll()` libera todas. `prisma.puzzle` é a fase em jogo.
- **Só dá para testar no óculos:** alcance e conforto da bancada, raio e mão encostando, giro
  do pulso, vibração, legibilidade do letreiro, FPS, e o visual de verdade (o teste do Node
  não desenha nada).

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", texto da fase no PC |
| `js/optics.js` | Cores em bits, 8 direções, reflexão, prisma e o traçado dos feixes (`trace`), junção de trechos para desenhar. Sem navegador |
| `js/puzzle.js` | `Puzzle`: peças na grade e na gaveta, colocar, tirar, girar, prévia, vitória. Sem navegador |
| `js/levels.js` | As 20 fases como mapas de texto (legenda no começo do arquivo) e os 4 grupos. Sem navegador |
| `js/solver.js` | Robô: busca a solução com menos peças; `applySolution` joga como o jogador. Sem navegador |
| `js/save.js` | Progresso e opções salvos |
| `js/main.js` | Liga tudo: render, VR (controles e mãos), mouse, pegar/girar peças, menus, sons, vibração, objeto `prisma` |
| `js/scene.js` | Laboratório, bancada, grade e gaveta (`BoardView`), peças, cristais pulsando, feixes (`Beams`) |
| `js/ui.js` | Painel de menu 3D e placas de texto |
| `js/audio.js` | Sons sintetizados: zumbido, cliques, acorde dos cristais, vitória |
| `tests/run.js`, `tests/robot.js` | Testes e o jogador robô |
| `tests/smoke/` | Teste do `main.js` no Node (navegador, Three.js renderer e controle falsos) |
| `serve.py` | Servidor local sem cache (porta 8801; `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas (metros, espaço do "palco"): jogador com a cabeça em x = 0, z = 0, olhando para -z.
Tampo da bancada em y = 0,92; centro da grade em z = -0,75; gaveta na frente da grade (mais
perto do jogador). Casa de 11 cm (grade maior encolhe até caber em 80 cm). Na grade, x cresce
para a direita e y para longe do jogador; direção 0 = leste, contando 45° no sentido
anti-horário visto de cima. No VR a bancada sobe/desce com a altura da cabeça (-0,45 a +0,35 m).

## Regras e convenções do projeto

- `optics.js`, `puzzle.js`, `levels.js`, `solver.js` e `save.js` não podem usar Three.js nem
  depender do navegador: os testes rodam no Node.
- Fase nova ou mudada: desenhar o mapa em `levels.js` e rodar `node tests/run.js`; o robô tem
  que resolver e cada peça da solução tem que ser necessária. A fase mestre do grupo tem que
  usar mais peças que a primeira do grupo. Gaveta com no máximo 5 ou 6 peças (a busca cresce
  rápido: a fase 15, com 5 peças, leva uns 3 s).
- Peça nova: regra em `optics.js` (`trace` e `ROT_STATES`), letra em `levels.js`, desenho em
  `scene.js` (`makePiece`) e teste em `tests/run.js`.
- Desempenho do Quest: 2 luzes (hemisférica + direcional), sem sombras, sem pós-processamento,
  feixes como caixas finas com mistura aditiva e névoa leve.

## Decisões

- Grade 2D com giros de 45°: a lógica fica exata, testável e o robô consegue provar que toda
  fase tem solução. As cores são 3 bits e cada componente é traçado separado, então a "soma
  exata" é um OU de bits.
- Cristal absorve o feixe (não deixa passar): misturar cor exige trazer feixes de lados
  diferentes até o mesmo cristal.
- Prisma só aceita luz por uma face; nas outras direções bloqueia. É a única peça que cria
  feixe diagonal a partir de reto, por isso fica no último grupo.
- Filtro sem orientação (não gira) para não confundir; filtros só de uma cor.
- Peças móveis começam todas na gaveta; peças presas ficam na grade (anel azul quando giram).
- Robô por busca com aprofundamento iterativo: só tenta peças nas casas por onde a luz já
  passa (numa solução, a primeira peça que a luz alcança está num caminho que já existe).
- Mesmo caminho dos outros jogos VR (WebXR no navegador, Three.js local, GitHub Pages).

## Pendências / problemas conhecidos

- Nada testado no Quest nem num navegador de verdade ainda: só a lógica e o `main.js` com
  navegador falso no Node. Conferir visual, tamanhos, alcance da gaveta, giro do pulso,
  rastreamento de mãos, vibração e FPS.
- A parte de trás da grade fica a ~1,1 m do jogador: dá para alcançar com o raio, não com a
  mão encostando.
- `prisma.dev.solve()` trava o navegador uns segundos nas fases 15 e 20 (busca do robô).
- Sem modelo 3D dos controles (só um cilindro e o raio).
