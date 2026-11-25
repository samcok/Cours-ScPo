const COLS = 60, ROWS = 40, S = 16; // S = taille d'une cellule en pixels
const ROUGE = '#E6142D', ENCRE = '#212121', TRAIT = '#E1E1E3';

// Motifs : # = cellule vivante
const PATTERNS = {
  'Vies stables': {
    'Bloc': ['##', '##'],
    'Ruche': ['.##.', '#..#', '.##.'],
  },
  'Oscillateurs': {
    'Clignotant': ['###'],
    'Crapaud': ['.###', '###.'],
    'Pulsar': [
      '..###...###..', '.............', '#....#.#....#', '#....#.#....#', '#....#.#....#',
      '..###...###..', '.............', '..###...###..', '#....#.#....#', '#....#.#....#',
      '#....#.#....#', '.............', '..###...###..'],
  },
  'Vaisseaux': {
    'Planeur': ['.#.', '..#', '###'],
    'Vaisseau léger': ['#..#.', '....#', '#...#', '.####'],
  },
  'Chaos et canons': {
    'Pentomino R': ['.##', '##.', '.#.'],
    'Canon de Gosper': [
      '........................#...........',
      '......................#.#...........',
      '............##......##............##',
      '...........#...#....##............##',
      '##........#.....#...##..............',
      '##........#...#.##....#.#...........',
      '..........#.....#.......#...........',
      '...........#...#....................',
      '............##......................'],
  },
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = COLS * S;
canvas.height = ROWS * S;

let grid = new Uint8Array(COLS * ROWS); // 0 = morte, sinon âge (1 = naissance)
let running = false, gen = 0, lastStep = 0, stepAt = 0;
let pattern = null, hover = null; // pattern = tableau de [dx, dy]
let painting = null; // état peint pendant un glisser (1 ou 0)

const $ = (id) => document.getElementById(id);
const idx = (x, y) => ((y + ROWS) % ROWS) * COLS + ((x + COLS) % COLS); // bords qui se rejoignent

const history = []; // grilles précédentes, 500 au plus
function back() {
  if (!history.length) return;
  [grid, gen] = history.pop();
  stepAt = performance.now();
  $('back').disabled = !history.length;
}

function step() {
  history.push([grid, gen]);
  if (history.length > 500) history.shift();
  $('back').disabled = false;
  const next = new Uint8Array(grid.length);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (dx || dy) n += grid[idx(x + dx, y + dy)] ? 1 : 0;
      const a = grid[y * COLS + x];
      next[y * COLS + x] = a ? (n === 2 || n === 3 ? Math.min(a + 1, 255) : 0) : (n === 3 ? 1 : 0);
    }
  }
  grid = next;
  gen++;
  stepAt = performance.now();
}

function draw(now) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = TRAIT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * S + .5, 0); ctx.lineTo(x * S + .5, canvas.height); }
  for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * S + .5); ctx.lineTo(canvas.width, y * S + .5); }
  ctx.stroke();

  // Animation : les naissances apparaissent en grossissant
  const t = Math.min(1, (now - stepAt) / 250);
  let pop = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const a = grid[y * COLS + x];
      if (!a) continue;
      pop++;
      const born = a === 1;
      const k = born ? 0.4 + 0.6 * t : 1;
      const m = (S - 2) * k;
      ctx.fillStyle = ENCRE;
      ctx.globalAlpha = born ? 0.5 + 0.5 * t : 1;
      ctx.fillRect(x * S + (S - m) / 2, y * S + (S - m) / 2, m, m);
    }
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = ROUGE;
  if (pattern && hover) for (const [dx, dy] of pattern) ctx.fillRect(((hover.x + dx + COLS) % COLS) * S + 1, ((hover.y + dy + ROWS) % ROWS) * S + 1, S - 2, S - 2);
  ctx.globalAlpha = 1;
  $('gen').textContent = gen;
  $('pop').textContent = pop;
}

function loop(now) {
  const delay = 1000 / +$('speed').value;
  if (running && now - lastStep >= delay) { step(); lastStep = now; }
  draw(now);
  requestAnimationFrame(loop);
}

// ---- Motifs ----
let rotation = 0, patternRows = null;
function cellsOf(rows, turns) {
  let cells = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => c === '#' && cells.push([x, y])));
  for (let i = 0; i < turns; i++) cells = cells.map(([x, y]) => [-y, x]); // rotation de 90°
  const minX = Math.min(...cells.map((c) => c[0])), minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

function select(rows, button) {
  patternRows = rows;
  document.querySelectorAll('.pattern').forEach((b) => b.classList.toggle('selected', b === button));
  $('rotate').disabled = $('pencil').disabled = !rows;
  rotation = 0;
  pattern = rows ? cellsOf(rows, 0) : null;
  $('hint').textContent = rows ? 'Cliquez sur la grille pour poser le motif. R pour pivoter, Échap pour revenir au crayon.' : 'Sélectionnez un motif puis cliquez sur la grille pour le poser.';
}

for (const [group, items] of Object.entries(PATTERNS)) {
  const h = document.createElement('h3'); h.textContent = group;
  const box = document.createElement('div'); box.className = 'group';
  for (const [name, rows] of Object.entries(items)) {
    const b = document.createElement('button');
    b.className = 'pattern';
    const c = document.createElement('canvas');
    const w = Math.max(...rows.map((r) => r.length)), p = Math.min(5, Math.floor(80 / w));
    c.width = w * p; c.height = rows.length * p;
    c.style.height = Math.min(32, rows.length * p) + 'px';
    const g = c.getContext('2d'); g.fillStyle = ENCRE;
    cellsOf(rows, 0).forEach(([x, y]) => g.fillRect(x * p, y * p, p - .5, p - .5));
    b.append(c, name);
    b.onclick = () => select(patternRows === rows ? null : rows, patternRows === rows ? null : b);
    box.append(b);
  }
  $('patterns').append(h, box);
}

$('rotate').onclick = () => { rotation = (rotation + 1) % 4; pattern = cellsOf(patternRows, rotation); };
$('pencil').onclick = () => select(null, null);
addEventListener('keydown', (e) => {
  if (e.key === 'r' && patternRows) $('rotate').click();
  if (e.key === 'Escape') select(null, null);
});

// ---- Souris ----
function cellAt(e) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) / r.width * COLS), y: Math.floor((e.clientY - r.top) / r.height * ROWS) };
}
canvas.addEventListener('pointerdown', (e) => {
  const c = cellAt(e);
  if (pattern) { pattern.forEach(([dx, dy]) => grid[idx(c.x + dx, c.y + dy)] = grid[idx(c.x + dx, c.y + dy)] || 1); stepAt = performance.now(); return; }
  painting = grid[idx(c.x, c.y)] ? 0 : 1;
  grid[idx(c.x, c.y)] = painting;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  hover = cellAt(e);
  if (painting !== null) grid[idx(hover.x, hover.y)] = painting;
});
canvas.addEventListener('pointerup', () => painting = null);
canvas.addEventListener('pointerleave', () => hover = null);

// ---- Boutons ----
$('play').onclick = () => { running = !running; $('play').textContent = running ? 'Pause' : 'Lecture'; };
$('step').onclick = step;
$('back').onclick = back;
function reset(g) { grid = g; gen = 0; history.length = 0; $('back').disabled = true; stepAt = performance.now(); }
$('clear').onclick = () => reset(new Uint8Array(COLS * ROWS));
$('random').onclick = () => reset(grid.map(() => Math.random() < 0.25 ? 1 : 0));

// Départ : un planeur et un canon pour que la page ne soit pas vide
cellsOf(PATTERNS['Vaisseaux']['Planeur'], 0).forEach(([x, y]) => grid[idx(x + 5, y + 5)] = 1);
requestAnimationFrame(loop);
