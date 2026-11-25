let COLS = 120, ROWS = 80, S = 13; // S = taille d'une cellule en pixels (canvas interne)
const ROUGE = '#E6142D', ENCRE = '#212121', TRAIT = '#E1E1E3';
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // haut, droite, bas, gauche

const $ = (id) => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const inside = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
const idx = (x, y) => y * COLS + x;

let grid = new Uint8Array(COLS * ROWS); // 1 = noire
let ant = { x: 60, y: 40, d: 0 };
let steps = 0, black = 0, running = false, acc = 0, last = 0, tool = 'draw', painting = null;

// Une étape est réversible sans historique : on remonte la fourmi et on réinverse la case.
function flip(i) { grid[i] ^= 1; black += grid[i] ? 1 : -1; }

function step() {
  const i = idx(ant.x, ant.y);
  const d = (ant.d + (grid[i] ? 3 : 1)) % 4; // noire : gauche, blanche : droite
  const x = ant.x + DIRS[d][0], y = ant.y + DIRS[d][1];
  if (!inside(x, y)) { setRunning(false); return; }
  flip(i);
  ant = { x, y, d };
  steps++;
}

function back() {
  if (!steps) return;
  const x = ant.x - DIRS[ant.d][0], y = ant.y - DIRS[ant.d][1], i = idx(x, y);
  ant = { x, y, d: (ant.d + (grid[i] ? 3 : 1)) % 4 }; // case noire maintenant : elle était blanche, virage à droite
  flip(i);
  steps--;
}

function draw() {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (S >= 6) {
    ctx.strokeStyle = TRAIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * S + .5, 0); ctx.lineTo(x * S + .5, canvas.height); }
    for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * S + .5); ctx.lineTo(canvas.width, y * S + .5); }
    ctx.stroke();
  }
  const g = S >= 6 ? 1 : 0;
  ctx.fillStyle = ENCRE;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (grid[idx(x, y)]) ctx.fillRect(x * S + g, y * S + g, S - g, S - g);

  const cx = (ant.x + .5) * S, cy = (ant.y + .5) * S, r = S * .5, [dx, dy] = DIRS[ant.d];
  ctx.fillStyle = ROUGE;
  ctx.beginPath();
  ctx.moveTo(cx + dx * r, cy + dy * r);
  ctx.lineTo(cx - dx * r * .8 - dy * r * .8, cy - dy * r * .8 + dx * r * .8);
  ctx.lineTo(cx - dx * r * .8 + dy * r * .8, cy - dy * r * .8 - dx * r * .8);
  ctx.fill();

  $('gen').textContent = steps;
  $('pop').textContent = black;
  $('back').disabled = !steps;
}

function loop(now) {
  if (running) {
    acc += (now - last) * $('speed').value ** 2 / 1000; // 1 à 10 000 étapes par seconde
    let n = Math.floor(acc);
    acc -= n;
    for (n = Math.min(n, 20000); n > 0 && running; n--) step();
  }
  last = now;
  draw();
  requestAnimationFrame(loop);
}

// ---- Souris ----
function cellAt(e) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) / r.width * COLS), y: Math.floor((e.clientY - r.top) / r.height * ROWS) };
}
function edit(c) {
  if (!inside(c.x, c.y)) return;
  if (tool === 'ant') ant = { ...ant, x: c.x, y: c.y };
  else if (grid[idx(c.x, c.y)] !== painting) flip(idx(c.x, c.y));
  steps = 0; // toute modification à la main supprime le retour en arrière
}
canvas.addEventListener('pointerdown', (e) => {
  const c = cellAt(e);
  if (tool === 'draw' && inside(c.x, c.y)) painting = grid[idx(c.x, c.y)] ? 0 : 1;
  edit(c);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => { if (painting !== null) edit(cellAt(e)); });
canvas.addEventListener('pointerup', () => painting = null);

// ---- Boutons ----
function setRunning(on) { running = on; $('play').textContent = on ? 'Pause' : 'Lecture'; }
function reset(g, a) {
  grid = g; ant = a; steps = 0;
  black = g.reduce((n, v) => n + v, 0);
}
const center = () => ({ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2), d: 0 });
$('play').onclick = () => setRunning(!running);
$('step').onclick = step;
$('back').onclick = back;
$('clear').onclick = () => { setRunning(false); reset(new Uint8Array(COLS * ROWS), center()); };
$('random').onclick = () => reset(grid.map(() => Math.random() < 0.1 ? 1 : 0), ant);
$('turn').onclick = () => { ant.d = (ant.d + 1) % 4; steps = 0; };
for (const t of ['draw', 'ant']) {
  $('tool-' + t).onclick = () => {
    tool = t;
    $('tool-draw').classList.toggle('selected', t === 'draw');
    $('tool-ant').classList.toggle('selected', t === 'ant');
  };
}

// ---- Taille de la grille ----
function resize(cols, rows) {
  const old = grid, oc = COLS;
  const next = new Uint8Array(cols * rows);
  for (let y = 0; y < Math.min(rows, ROWS); y++)
    for (let x = 0; x < Math.min(cols, COLS); x++) next[y * cols + x] = old[y * oc + x];
  COLS = cols; ROWS = rows;
  ant = { ...ant, x: Math.min(ant.x, COLS - 1), y: Math.min(ant.y, ROWS - 1) };
  reset(next, ant);
  S = Math.max(5, Math.min(16, Math.floor(1600 / COLS)));
  canvas.width = COLS * S; canvas.height = ROWS * S;
}
for (const k of ['w', 'h']) {
  const range = $(k + '-range'), num = $(k + '-num');
  const apply = (v) => {
    v = Math.min(300, Math.max(1, Math.round(+v)));
    if (!v) return;
    range.value = v;
    k === 'w' ? resize(v, ROWS) : resize(COLS, v);
  };
  range.oninput = () => { num.value = range.value; apply(range.value); };
  num.oninput = () => num.value !== '' && apply(num.value);
  num.onchange = () => { apply(num.value); num.value = range.value; };
}
resize(COLS, ROWS);
requestAnimationFrame(loop);
