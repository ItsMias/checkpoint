// Loading-screen background: "digital rain" drawn on the page's own 5px dot grid, so it reads as
// the background dots lighting up, plus little dot sprites (bits, a rewind arrow, a flag…) that
// flicker in and out. The canvas is transparent; the CSS dot grid shows through. Returns stop().

const CELL = 5; // matches the .stage::after dot grid
const DOT = 2; // dot size in px, like the 1.8px background dots
const FPS = 30;

// Dot sprites, one string per row ("#" = lit).
const SPRITES = [
  [".#.", "##.", ".#.", ".#.", "###"], // 1
  ["###", "#.#", "#.#", "#.#", "###"], // 0
  [".#.", "###", ".#."], // plus
  ["###", "#.#", "###"], // box
  ["#.#", ".#.", "#.#"], // x
  ["...#...#", "..##..##", ".###.###", "########", ".###.###", "..##..##", "...#...#"], // rewind
  ["####.", "#.###", "####.", "#....", "#...."], // checkpoint flag
  [".#.#.", "#####", "#####", ".###.", "..#.."], // heart
  ["..#..", "..#..", "##.##", "..#..", "..#.."], // sparkle
  ["#####", "#...#", "#####", ".#..."], // chat bubble
  [".#####.", "##.#.##", "#######", "##...##"], // controller
  ["#.#.#.#"], // dashed line
  ["##", "##"], // block
];

export function matrixRain(canvas) {
  const g = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = getComputedStyle(document.documentElement);
  const stage = canvas.closest(".stage") ?? document.body;
  let w = 0, h = 0, cols = 0, rows = 0, ox = 0, oy = 0;
  let drops = [], bobs = [], twinkles = [];
  let raf = 0, last = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const dot = (c, r, size = DOT) => {
    const x = ox + c * CELL + (CELL - size) / 2, y = oy + r * CELL + (CELL - size) / 2;
    g.fillRect(x, y, size, size);
  };

  const newDrop = (anywhere) => ({
    col: (Math.random() * cols) | 0,
    y: anywhere ? rnd(-rows * 0.3, rows) : rnd(-rows * 0.6, 0),
    speed: rnd(0.35, 1.1),
    len: (rnd(6, 26)) | 0,
  });

  const newBob = (t) => {
    const s = SPRITES[(Math.random() * SPRITES.length) | 0];
    return {
      s, t0: t, life: rnd(1200, 3200),
      col: (Math.random() * Math.max(1, cols - s[0].length)) | 0,
      row: (Math.random() * Math.max(1, rows - s.length)) | 0,
      bright: Math.random() < 0.5,
    };
  };

  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Line the grid up with the CSS dots, which start at the stage's top-left corner.
    const a = canvas.getBoundingClientRect(), b = stage.getBoundingClientRect();
    ox = (((b.left - a.left) % CELL) + CELL) % CELL - CELL;
    oy = (((b.top - a.top) % CELL) + CELL) % CELL - CELL;
    cols = Math.ceil(w / CELL) + 2;
    rows = Math.ceil(h / CELL) + 2;
    const want = Math.round(cols * 0.28);
    while (drops.length < want) drops.push(newDrop(true));
    drops.length = want;
  };

  const draw = (t) => {
    const accent = css.getPropertyValue("--accent").trim() || "#3df07a";
    g.clearRect(0, 0, w, h);
    g.fillStyle = accent;

    // Rain: a bright head dot and a fading tail.
    for (const d of drops) {
      const head = Math.floor(d.y);
      for (let k = d.len - 1; k >= 0; k--) {
        const r = head - k;
        if (r < 0 || r >= rows) continue;
        g.globalAlpha = k === 0 ? 1 : 0.7 * (1 - k / d.len) ** 1.5;
        dot(d.col, r, k === 0 ? DOT + 1 : DOT);
      }
    }

    // Single dots that blink on and off.
    for (const tw of twinkles) {
      const p = (t - tw.t0) / tw.life;
      g.globalAlpha = 0.8 * Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
      dot(tw.col, tw.row);
    }

    // Sprites: flicker in, hold, fade out. Bright ones get a soft glow.
    g.shadowColor = accent;
    for (const b of bobs) {
      const age = t - b.t0, p = age / b.life;
      const a = p < 0.15 ? (Math.random() < 0.5 ? 1 : 0.15) : p > 0.75 ? (1 - p) / 0.25 : 1;
      g.globalAlpha = a * (b.bright ? 1 : 0.7);
      g.shadowBlur = b.bright ? 6 : 0;
      b.s.forEach((line, r) => {
        for (let c = 0; c < line.length; c++) if (line[c] === "#") dot(b.col + c, b.row + r, DOT + 0.5);
      });
    }
    g.shadowBlur = 0;
    g.globalAlpha = 1;
  };

  const step = (t) => {
    for (const d of drops) {
      d.y += d.speed;
      if (d.y - d.len > rows) Object.assign(d, newDrop(false));
    }
    bobs = bobs.filter((b) => t - b.t0 < b.life);
    if (bobs.length < 18 && Math.random() < 0.18) bobs.push(newBob(t));
    twinkles = twinkles.filter((tw) => t - tw.t0 < tw.life);
    while (twinkles.length < 40) {
      twinkles.push({ col: (Math.random() * cols) | 0, row: (Math.random() * rows) | 0, t0: t, life: rnd(400, 1600) });
    }
  };

  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    if (t - last < 1000 / FPS) return;
    last = t;
    step(t);
    draw(t);
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  if (reduce) {
    // One still frame: a few sprites, no motion.
    const t = performance.now();
    for (let i = 0; i < 10; i++) bobs.push({ ...newBob(t), t0: t - 1000, life: 4000 });
    drops = [];
    draw(t);
  } else {
    raf = requestAnimationFrame(frame);
  }
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}
