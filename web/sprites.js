// Persona pixel art, drawn for this project as text grids ('.' = transparent).
// The ten characters are the ones from Discord's Checkpoint 2025 cards; the art is our own.

/** Colours per character, matched to the real cards: the card face and the art panel's gradient. */
export const THEMES = {
  bonsai: { card: "#62e38a", art: ["#86ea8c", "#4cc95e"] },
  donut: { card: "#7ff2dc", art: ["#96ecdc", "#5fcfbb"] },
  capybara: { card: "#85a7e4", art: ["#7a8ff0", "#5d6fe0"] },
  disco: { card: "#b99af5", art: ["#a88cf2", "#7d5fd8"] },
  origami: { card: "#f06ad8", art: ["#f78be4", "#e04fc0"] },
  snail: { card: "#ff6f9a", art: ["#ff86a8", "#f0507f"] },
  duck: { card: "#ff9a3c", art: ["#ff7e30", "#ff5a1f"] },
  banana: { card: "#f6d93c", art: ["#ffd84a", "#ff9f1c"] },
  cat: { card: "#d9b36c", art: ["#c9a46a", "#8a6a3a"] },
  cassette: { card: "#e4e4ea", art: ["#d4d4da", "#9a9aa4"] },
};
export const theme = (id) => THEMES[id] ?? THEMES.capybara;

const SPRITES = {
  capybara: {
    pal: { d: "#3b2414", b: "#b07a45", l: "#d9a066", k: "#1a1a1a", n: "#5a3520", p: "#f4a6b8", r: "#5d6fe0", w: "#c9d3ff" },
    rows: [
      "......................",
      "...........dd..dd.....",
      "..........dbbddbbd....",
      "..........dbbbbbbd....",
      ".........dbbbbbbbbd...",
      "....ddddddbbbbkbbbbd..",
      "...dbbbbbbbbbbbbbbbd..",
      "..dbbbbbbbbbbbbbbbnnd.",
      ".dbbbbbbbbbbbpbbbbnnd.",
      ".dbbbbbbbbbbbbbbbbbd..",
      "dbbllbbbbbbbbbbbbdd...",
      "dbbllbbbbbbbbbbbbd....",
      "ddrrrrrrrrrrrrrrrrdd..",
      "drwwrrrrrrrrrrrrwwrd..",
      ".dddrrrrrrrrrrrrrddd..",
      ".dbbdd.dbbd.dbbd......",
      ".dddd..dddd.dddd......",
    ],
  },
  snail: {
    pal: { d: "#4a1530", p: "#f06a9c", s: "#b83a6e", l: "#ffb3cf", o: "#ff9f5a", h: "#ffc98f", w: "#ffffff", k: "#151515", c: "#ff7aa8" },
    rows: [
      "..............dddd.dddd..",
      "..............dwwd.dwwd..",
      "..............dwkd.dwkd..",
      "....dddddd....dddd.dddd..",
      "..ddppppppdd....d...d....",
      ".dpplllppppd....d...d....",
      ".dplssssssppd..ddddddd...",
      "dplsppppppspd.dhooooood..",
      "dplspssssppsd.dhoooooood.",
      "dplspsppsppsd.dhookoookd.",
      "dpplspsspspsd.dhooooooood",
      ".dpplsppppspd.dhooccoood.",
      ".dddppssssppdddoooooooood",
      "dhhhdddddddddhhhhhhhhhhd.",
      "dooooooooooooooooooooood.",
      ".dddddddddddddddddddddd..",
    ],
  },
  cat: {
    pal: { d: "#4a2008", o: "#f08c3a", s: "#c2601e", l: "#ffd9ad", g: "#7fd36b", k: "#151515", p: "#f4a6b8", w: "#ffffff" },
    rows: [
      "..dd..........dd......",
      "..dod........dod......",
      "..dpod......dopd......",
      "..doooddddddoood......",
      ".dosooosoooosooosd....",
      ".doooooooooooooood....",
      "doogkoooooooogkood....",
      "doogkoooooooogkood....",
      "dooooooopppoooooood...",
      ".dollloooooooolllod...",
      "..dllllllllllllld..dd.",
      "..doosllllllsood..dod.",
      ".dooosllllllsooodddod.",
      ".doooollllllooooooodd.",
      ".doosooooooooosood....",
      ".dlld.dlld.dlld.dlld..",
      "..dd...dd...dd...dd...",
    ],
  },
  bonsai: {
    pal: { d: "#12361c", g: "#3fbf5a", l: "#8ae07a", t: "#6b3f22", n: "#8c5a33", b: "#b87944", m: "#d99a5c", k: "#1a1a1a", p: "#f4a6b8" },
    rows: [
      "......dddd..dddd......",
      "....ddggggddgglldd....",
      "...dgglllgggglllggd...",
      "..dgglllggggggllgggd..",
      "..dggggggggddgggggggd.",
      "...ddgggggdttdgggggd..",
      ".....ddddd.dtd.ddddd..",
      "...........dtd........",
      "..........dtd.........",
      "..........dtdd........",
      "..dddddddddddddddddd..",
      ".dmmmmmmmmmmmmmmmmmmd.",
      ".dbbbbbbbbbbbbbbbbbbd.",
      "..dbbkbbbbbbbbbbkbbd..",
      "..dbpbbbbkbbkbbbbpbd..",
      "...dbbbbbbkkbbbbbbd...",
      "...dnnnnnnnnnnnnnnd...",
      "....dddddddddddddd....",
    ],
  },
  duck: {
    pal: { d: "#4a3200", y: "#ffd23f", l: "#fff09a", o: "#ff8c1a", c: "#7b5cd6", v: "#a58cf0", k: "#151515", w: "#ffffff", u: "#6fb8ff", e: "#bfe3ff" },
    rows: [
      "......ddddddd.........",
      ".....dvvvvvvvd........",
      "....dcvvvvvvvcd.......",
      "....dccccccccccdddd...",
      "....dyyyyyyyyyddvvvd..",
      "...dyyyyyyyyyyyddddd..",
      "...dyyyywkyyyyyyd.....",
      "...dyyyykkyyyyooood...",
      "...dlyyyyyyyyyoooood..",
      "....dlyyyyyyyydddddd..",
      "..ddlyyyyyyyyyyd......",
      ".dyylyyyyyyyyyyyd.....",
      "dyyyyyyyyyyyyyyyyd....",
      "dlyyyyyyyyyyyyyyyd....",
      ".dlllyyyyyyyyyyydd....",
      "udddddddddddddddddu.u.",
      "eueueueueueueueueueueu",
    ],
  },
  banana: {
    pal: { d: "#4a3a00", y: "#ffe14a", l: "#fff3a3", g: "#c9a415", b: "#6b4f12", w: "#fffbe6", k: "#151515", p: "#f4a6b8" },
    rows: [
      "........dd............",
      "........bd............",
      ".......dlyd...........",
      "......dlyyyd..........",
      "......dlwwyd..........",
      "......dlwkwkd.........",
      "......dlwwwwd.........",
      "......dlpwwpd.........",
      "......dlwkkwd.........",
      ".....ddlwwwwdd........",
      "...ddyydwwwwdyydd.....",
      "..dyyylldwwdlyyyydd...",
      ".dyylyyyyddyyyyyyyydd.",
      "dyyyllyyyyyyyyyyyyyggd",
      "dgyyyyyyyyyyyyyyyggdd.",
      ".ddgggyyyyyyyyggdd....",
      "...dddgggggggdd.......",
      "......ddddddd.........",
    ],
  },
  donut: {
    pal: { d: "#5a2412", b: "#d98a45", l: "#f2b36b", p: "#ff7eb3", q: "#ffb3d1", w: "#ffffff", y: "#ffe066", u: "#6fd3ff", g: "#7ce08a", k: "#1a1a1a" },
    rows: [
      "......dddddddddd......",
      "....ddppppppppppdd....",
      "...dppqqpppywpppppd...",
      "..dpqqpupppppppgpppd..",
      ".dpqppppppppppppppypd.",
      ".dpppgppdddddpppuppd..",
      "dpppppppd...dpppppppd.",
      "dppywppd.....dppwpppd.",
      "dpppkppd.....dpkppppd.",
      "dlpppppd.....dppppppd.",
      "dllppppld...dlppppld..",
      ".dllppllldddllpppld...",
      ".dbllllllllllllllld...",
      "..dbbllllllllllllbd...",
      "...ddbbbbbbbbbbbdd....",
      ".....dddddddddddd.....",
    ],
  },
  cassette: {
    pal: { d: "#2a1418", r: "#e35f4c", q: "#ff8a78", w: "#fff4ea", g: "#cfc6c0", k: "#151515", b: "#3a3a46", p: "#f4a6b8" },
    rows: [
      "dddddddddddddddddddddd",
      "drrrrrrrrrrrrrrrrrrrrd",
      "drqqqqqqqqqqqqqqqqqqrd",
      "drwwwwwwwwwwwwwwwwwwrd",
      "drwwkkwwwwwwwwwwkkwwrd",
      "drwwkkwwwwwwwwwwkkwwrd",
      "drwpwwwwwwkkwwwwwwpwrd",
      "drwwwwwwwwwwwwwwwwwwrd",
      "drwwwddddddddddddwwwrd",
      "drwwdbbbbbbbbbbbbdwwrd",
      "drwwdbgkgbbbbgkgbdwwrd",
      "drwwdbbbbbbbbbbbbdwwrd",
      "drwwwddddddddddddwwwrd",
      "drrrrrrrrrrrrrrrrrrrrd",
      "drrrrdddddddddddddrrrd",
      "drrrdrrrrrrrrrrrrdrrrd",
      "dddddddddddddddddddddd",
    ],
  },
  origami: {
    pal: { d: "#5a1047", p: "#f47ad4", l: "#ffb8ec", m: "#c94aa8", w: "#ffffff", k: "#151515" },
    rows: [
      "...........d..........",
      "..........dld.........",
      ".........dlld....dddd.",
      "........dllld....dwkd.",
      ".......dlllld....ddddp",
      "d.....dllllmd...dpd...",
      "dd...dlllllmd..dpd....",
      "dpd.dllllllmd.dpd.....",
      ".dpdlllllllmddpd......",
      "..dpdddddddddppd......",
      "..dpppppppmmmppd......",
      "...dpppppmmmmpd.......",
      "....dpppmmmmmd........",
      ".....ddpmmmmd.........",
      ".......ddddd..........",
    ],
  },
  disco: {
    pal: { d: "#241a3d", a: "#c9d3ff", b: "#8fa3e8", c: "#5d6fe0", w: "#ffffff", y: "#ffd23f", o: "#ff9f1c", k: "#1a1a1a", s: "#fff6a8" },
    rows: [
      "..........dd..........",
      "..........dd......s...",
      "........dddddd...sss..",
      "......dbcwbcabcd..s...",
      ".....dcawcabcabcd.....",
      "....dabwabcabcabcd....",
      "...dbcwbcabcabcabcd...",
      ".dddddddddddddddddddd.",
      ".dyoyyyyyddddyoyyyyyd.",
      ".dyyyyyyyddddyyyyyyyd.",
      "..dddddddcabcddddddd..",
      "...dcabcabcabcabcad...",
      "...dbcabcabcabcabcd...",
      "....dbcabkabkabcad....",
      ".s...dbcabkkbcabd.....",
      "sss...dbcabcabcd......",
      ".s......dddddd........",
      "......................",
    ],
  },
};

/** Draws a persona sprite onto a canvas at integer scale. */
export function drawSprite(canvas, id, scale = 8) {
  const s = SPRITES[id] ?? SPRITES.capybara;
  const w = Math.max(...s.rows.map((r) => r.length));
  const h = s.rows.length;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  s.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = s.pal[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return canvas;
}

/**
 * Card back: a fine dot grid in the card's colour with dark camouflage blotches (seeded, so the
 * same user always gets the same back) and the Discord logo in the middle.
 */
export function drawCardBack(canvas, seed = 1, color = THEMES.capybara.card) {
  const W = 36, H = 54, S = 8;
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d");
  let x = seed >>> 0 || 1;
  const rand = () => ((x ^= x << 13), (x ^= x >>> 17), (x ^= x << 5), (x >>> 0) / 4294967296);

  // Blotches: random cells smoothed a few times so they clump into blobs.
  let on = Array.from({ length: W * H }, () => rand() < 0.47);
  for (let pass = 0; pass < 4; pass++) {
    on = on.map((_, n) => {
      const i = n % W, j = Math.floor(n / W);
      let c = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        c += ii < 0 || jj < 0 || ii >= W || jj >= H ? 0 : on[jj * W + ii] ? 1 : 0;
      }
      return c >= 5;
    });
  }
  ctx.fillStyle = "#0d0b12";
  ctx.fillRect(0, 0, W * S, H * S);
  on.forEach((dark, n) => {
    ctx.fillStyle = dark ? "#1c1a2b" : color;
    ctx.fillRect((n % W) * S + 1, Math.floor(n / W) * S + 1, S - 2, S - 2);
  });

  // Centre badge. The Discord logo goes on top of it as a vector (see .back-logo in style.css).
  const bs = 14 * S, bx = ((W * S) - bs) / 2, by = ((H * S) - bs) / 2;
  ctx.fillStyle = color;
  ctx.fillRect(bx - S, by - S, bs + 2 * S, bs + 2 * S);
  ctx.fillStyle = "#0d0b12";
  ctx.fillRect(bx, by, bs, bs);
  return canvas;
}

export const PERSONA_IDS = Object.keys(SPRITES);
