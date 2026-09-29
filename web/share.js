// Draws a 1080×1350 summary image locally and downloads it. No network, no avatars
// (keeps the canvas untainted and the image free of other people's pictures).

import { drawSprite, theme } from "./sprites.js";

const INK = "#0d0b12";

/** "#rrggbb" + alpha -> "rgba(...)". */
const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;
const yearOf = (s) => new Date(s.window.from).getUTCFullYear();

export async function saveSummaryImage(s) {
  const t = theme(s.persona.id);
  const ACCENT = t.card;
  await document.fonts.ready;
  const W = 1080, H = 1350;
  const { c, g } = backdrop(W, H, ACCENT);

  // Header.
  g.fillStyle = ACCENT;
  g.font = "800 26px Unbounded";
  g.fillText(`YOUR CHECKPOINT ${yearOf(s)}`, 72, 110);
  g.font = "900 120px Unbounded";
  g.fillText("SUMMARY", 64, 230);

  // Collectible card, tilted.
  g.save();
  g.translate(250, 700);
  g.rotate(-0.1);
  drawCard(g, s);
  g.restore();

  // Stats column.
  const rows = [
    ["MESSAGES SENT", s.messages.total.toLocaleString("en-US")],
    s.voice && ["HOURS IN VOICE", Math.round(s.voice.hours).toLocaleString("en-US")],
    ["EMOJIS USED", s.emojis.total.toLocaleString("en-US")],
    s.squad[0] && ["SIDEKICK", s.squad[0].display_name],
    s.servers[0] && ["TOP SERVER", s.servers[0].name],
    s.games?.top[0] && ["MOST PLAYED GAME", s.games.top[0].name],
  ].filter(Boolean);
  let y = 420;
  for (const [label, value] of rows) {
    g.fillStyle = ACCENT;
    g.font = "800 20px Unbounded";
    g.fillText(label, 520, y);
    g.font = /^\d/.test(value) ? "700 64px 'Pixelify Sans'" : "600 44px 'Barlow Semi Condensed'";
    g.fillText(fit(g, value, 500), 520, y + 62);
    y += 140;
  }

  footer(g, H, ACCENT);
  await download(c, `checkpoint-${yearOf(s)}.png`);
}

function backdrop(W, H, accent) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#110e17";
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.28, -100, 0, W * 0.28, -100, H * 0.8);
  glow.addColorStop(0, rgba(accent, 0.35));
  glow.addColorStop(1, rgba(accent, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.fillStyle = rgba(accent, 0.16);
  for (let y = 3; y < H; y += 9) for (let x = 3; x < W; x += 9) g.fillRect(x, y, 2, 2);
  return { c, g };
}

/** The collectible card (330×484), centred on the current origin. */
function drawCard(g, s) {
  const t = theme(s.persona.id);
  const cw = 330, ch = 484;
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.fillRect(-cw / 2 + 16, -ch / 2 + 18, cw, ch);
  g.fillStyle = t.card;
  g.fillRect(-cw / 2, -ch / 2, cw, ch);
  const art = drawSprite(document.createElement("canvas"), s.persona.id, 10);
  const ax = -cw / 2 + 14, ay = -ch / 2 + 40, aw = cw - 28, ah = 290;
  const artBg = g.createLinearGradient(0, ay, 0, ay + ah);
  artBg.addColorStop(0, t.art[0]);
  artBg.addColorStop(1, t.art[1]);
  g.fillStyle = artBg;
  g.fillRect(ax, ay, aw, ah);
  g.imageSmoothingEnabled = false;
  const scale = Math.min((aw * 0.82) / art.width, (ah * 0.82) / art.height);
  g.drawImage(art, ax + (aw - art.width * scale) / 2, ay + (ah - art.height * scale) / 2, art.width * scale, art.height * scale);
  g.fillStyle = INK;
  g.font = "400 15px 'Space Mono'";
  g.fillText(`LVL ${s.card.level}`, -cw / 2 + 14, -ch / 2 + 28);
  g.font = "700 14px 'Space Mono'";
  g.fillText(`CHECKPOINT ${yearOf(s)} • #${String(s.card.number).padStart(4, "0")}`, -cw / 2 + 14, ay + ah + 32);
  g.textAlign = "right";
  g.fillText(`${s.persona.number}/${s.persona.of}`, cw / 2 - 14, ay + ah + 32);
  g.textAlign = "left";
  g.font = "900 44px Unbounded";
  g.fillText(s.persona.name, -cw / 2 + 14, ay + ah + 86);
}

function footer(g, H, accent) {
  g.fillStyle = rgba(accent, 0.7);
  g.font = "400 20px 'Space Mono'";
  g.fillText("Unofficial • Not affiliated with Discord", 72, H - 60);
}

async function download(c, name) {
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function fit(g, text, max) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}
