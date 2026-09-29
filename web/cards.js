// The recap cards. Each card: { id, accent, icon, show(stats), render(stats, ctx) -> HTML string, mount?(el, stats, ctx) }.
// All data-package strings (names, emoji names) go through esc(): they are user-controlled.

import { icons } from "./icons.js";
import { drawCardBack, drawSprite, theme } from "./sprites.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const year = (s) => new Date(s.window.from).getUTCFullYear();

// ---------- shared bits ----------

const doodles = (third) => `<div class="doodles">${icons.globe}${icons.eq}${third}</div>`;
const eyebrow = (icon, text) => `<p class="eyebrow">${icon}${esc(text)}</p>`;
const count = (n) => `<p class="big-number" data-count="${Math.round(n)}">0</p>`;

function cube(face) {
  return `<div class="cube-wrap" aria-hidden="true"><div class="cube">${Array(6).fill(`<div>${face}</div>`).join("")}</div></div>`;
}

function avatarUrl(p, ctx) {
  if (!ctx.cdn || !p?.id) return null;
  if (p.avatar) return `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.webp?size=128`;
  try {
    return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(p.id) >> 22n) % 6n)}.png`;
  } catch {
    return null;
  }
}

export function avatar(p, ctx, { tag = true } = {}) {
  const url = avatarUrl(p, ctx);
  const inner = url
    ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="ph">${esc([...(p?.display_name || "?")][0].toUpperCase())}</span>`;
  return `<span class="avatar">${inner}${tag ? `<span class="tag">${esc(p?.display_name)}</span>` : ""}</span>`;
}

export function emojiHtml(e, ctx) {
  if (e.text) return esc(e.text);
  if (ctx.cdn && e.id) {
    const ext = e.animated ? "gif" : "webp";
    return `<img src="https://cdn.discordapp.com/emojis/${esc(e.id)}.${ext}?size=96" alt=":${esc(e.name)}:" referrerpolicy="no-referrer">`;
  }
  return `<span style="font: 700 0.22em/1 var(--mono)">:${esc(e.name)}:</span>`;
}

function collectible(s, { revealed = false, static: isStatic = false } = {}) {
  const p = s.persona;
  const t = theme(p.id);
  return `
    <div class="collectible${revealed ? " revealed" : ""}${isStatic ? " static" : ""}" style="--card:${t.card};--art-a:${t.art[0]};--art-b:${t.art[1]}">
      <div class="flip">
        <div class="back"><canvas data-back="${esc(s.card.number)}" data-color="${t.card}"></canvas><span class="back-logo">${icons.discord}</span></div>
        <div class="face">
          <div class="lvl"><i></i><span>LVL <b>${esc(s.card.level)}</b></span></div>
          <div class="art"><canvas data-sprite="${esc(p.id)}"></canvas></div>
          <div class="meta"><span>CHECKPOINT ${year(s)} • #${String(s.card.number).padStart(4, "0")}</span><span>${p.number}/${p.of}</span></div>
          <div class="pname">${esc(p.name)}</div>
          <div class="icons">${icons.globe}${icons.barcode}${icons.ring}<span class="badge">${icons.flag}</span></div>
        </div>
      </div>
    </div>`;
}

/** Swaps `el`'s contents for an image once it loads; leaves the placeholder if it fails. */
function swapInImage(el, url, cls = "") {
  if (!el || !url) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    if (cls) img.className = cls;
    img.onload = () => { el.replaceChildren(img); el.classList.add("has-img"); resolve(true); };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function paintCanvases(root) {
  root.querySelectorAll("canvas[data-sprite]").forEach((c) => drawSprite(c, c.dataset.sprite, 8));
  root.querySelectorAll("canvas[data-back]").forEach((c) => drawCardBack(c, Number(c.dataset.back) + 7, c.dataset.color));
}

// ---------- cards ----------

export const CARDS = [
  {
    id: "intro",
    accent: "#3df07a",
    icon: icons.home,
    show: () => true,
    render: (s) => `
      <div class="landing">
        <h1 class="headline xl">Checkpoint</h1>
        <p class="lede">Look back at your ${year(s)} on Discord${s.user ? `, <b>${esc(s.user.display_name)}</b>` : ""}.</p>
        ${doodles(icons.flag)}
        <button class="btn" data-next type="button" style="margin-top:34px">${icons.play} Start</button>
      </div>`,
  },
  {
    id: "messages",
    accent: "#e24fd0",
    icon: icons.chat,
    show: (s) => s.messages.total > 0,
    render: (s) => {
      const days = Math.max(1, (s.window.to - s.window.from) / 864e5);
      const busiest = s.messages.by_month.indexOf(Math.max(...s.messages.by_month));
      return `
        <div class="pair">
          ${cube(icons.chat)}
          <div>
            ${eyebrow(icons.chat, "Messages sent this year")}
            ${count(s.messages.total)}
            <p class="lede">That's about <b>${fmt(s.messages.total / days)} a day</b>. You were chattiest in <b>${MONTHS[busiest]}</b>.</p>
            ${doodles(icons.chat)}
          </div>
        </div>`;
    },
  },
  {
    id: "emojis",
    accent: "#b48cf7",
    icon: icons.smile,
    show: (s) => s.emojis.total > 0,
    render: (s, ctx) => `
      <div class="pair">
        ${cube(emojiHtml(s.emojis.top[0], ctx))}
        <div>
          ${eyebrow(icons.smile, "Total emojis used")}
          ${count(s.emojis.total)}
          <p class="lede">Here are a few of your favourites:</p>
          <div class="doodles" style="flex-wrap:wrap;gap:10px">
            ${s.emojis.top.map((e, i) => `<span class="btn ghost" style="padding:6px 10px;font-size:22px;gap:6px"><span style="display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;font-size:22px">${emojiHtml(e, ctx).replace("<img ", '<img style="width:26px;height:26px;object-fit:contain" ')}</span><span style="font:700 13px/1 var(--digits)">#${i + 1}</span></span>`).join("")}
          </div>
          ${doodles(icons.smile)}
        </div>
      </div>`,
  },
  {
    id: "voice",
    accent: "#f2cf45",
    icon: icons.mic,
    show: (s) => (s.voice?.hours ?? 0) >= 1,
    render: (s) => `
      <div class="ringed">
        <span class="ring"></span>
        ${eyebrow(icons.mic, "Hours in voice")}
        ${count(s.voice.hours)}
        <p class="lede" style="max-width:40ch">That's <b>${fmt(s.voice.hours / 24)} days</b> of hanging out in voice, across ${fmt(s.voice.sessions)} sessions.</p>
        <div style="display:flex;justify-content:center">${doodles(icons.phone)}</div>
      </div>`,
  },
  {
    id: "servers",
    accent: "#5ef2c2",
    icon: icons.servers,
    show: (s) => s.servers.length > 0,
    render: (s) => {
      const tile = (g, i) => `
        <div class="tile${i === 0 ? " wide" : ""}">
          <span class="rank">#${i + 1}</span>
          <span class="initial" data-server="${esc(g.id)}">${esc([...g.name][0] ?? "?")}</span>
          <span class="name">${esc(g.name)}</span>
          <span class="kv">
            <div><small>Messages sent</small><span>${fmt(g.messages)}</span></div>
            ${g.voice_hours >= 1 ? `<div><small>Hours in voice</small><span>${fmt(g.voice_hours)}</span></div>` : ""}
          </span>
        </div>`;
      return `
        <div class="servers">
          <div class="servers-head">
            <div>${eyebrow(icons.servers, "Your favourite")}<h2 class="headline">Servers</h2></div>
            <div><p class="lede">The places on Discord you called home in ${year(s)}.</p>${doodles(icons.flag)}</div>
          </div>
          <div class="tiles">${s.servers.slice(0, 3).map(tile).join("")}</div>
          ${s.servers.length > 3 ? `
            <div class="more-servers" id="more-servers" hidden>
              ${s.servers.slice(3).map((g, i) => `
                <div class="row" style="animation-delay:${i * 45}ms">
                  <span class="row-rank">#${i + 4}</span>
                  <span class="initial" data-server="${esc(g.id)}">${esc([...g.name][0] ?? "?")}</span>
                  <span class="name">${esc(g.name)}</span>
                  <span class="row-stats">
                    <span>${fmt(g.messages)} <small>msgs</small></span>
                    ${g.voice_hours >= 1 ? `<span>${fmt(g.voice_hours)} <small>hrs</small></span>` : ""}
                  </span>
                </div>`).join("")}
            </div>
            <button class="btn ghost more-btn" type="button" data-more aria-expanded="false" aria-controls="more-servers">
              <span>Show your top ${s.servers.length}</span>${icons.chevron}
            </button>` : ""}
        </div>`;
    },
    mount(el, s, ctx) {
      for (const box of el.querySelectorAll("[data-server]")) {
        ctx.art?.servers.get(box.dataset.server)?.then((r) => {
          swapInImage(box, r.icon);
          // A server the package couldn't name, recovered from an invite.
          if (r.name) box.parentElement.querySelector(".name").textContent = r.name;
        });
      }
      const btn = el.querySelector("[data-more]");
      btn?.addEventListener("click", () => {
        const list = el.querySelector("#more-servers");
        const open = list.hidden;
        list.hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
        btn.querySelector("span").textContent = open ? "Show less" : `Show your top ${s.servers.length}`;
        if (open) list.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
  },
  {
    id: "sidekick",
    accent: "#a5a2f2",
    icon: icons.person,
    show: (s) => s.squad.length > 0,
    render: (s, ctx) => {
      const p = s.squad[0];
      const dmTotal = s.squad.reduce((n, x) => n + x.messages, 0);
      const share = dmTotal ? Math.round((p.messages / dmTotal) * 100) : 0;
      // The rest of the squad floats around the edges (the original had no separate squad card).
      const spots = [["3%", "8%"], ["86%", "6%"], ["2%", "68%"], ["87%", "66%"]];
      const floaters = s.squad.slice(1, 5).map((f, i) =>
        `<div class="floater" style="left:${spots[i][0]};top:${spots[i][1]};animation-delay:${-i * 1.7}s">${avatar(f, ctx)}</div>`).join("");
      return `
        <div class="squad">
        ${floaters}
        <div class="sidekick center">
          <div class="duo">${s.user ? avatar(s.user, ctx) : ""}<span class="link"></span>${avatar(p, ctx)}</div>
          <div>${eyebrow(icons.person, "Your Discord")}<h2 class="headline">Sidekick</h2></div>
          <div class="stats-row">
            <div class="stat"><small>Messages sent</small><span data-count="${p.messages}">0</span></div>
            ${p.voice_hours >= 1 ? `<div class="stat"><small>Hours in voice</small><span data-count="${Math.round(p.voice_hours)}">0</span></div>` : ""}
          </div>
          <div class="panel">
            <header>${esc(p.display_name).toUpperCase()} • YOUR PLAYER TWO</header>
            <p>${share}% of the DMs you sent went to ${esc(p.display_name)}${p.voice_hours >= 24 ? `, and you spent ${fmt(p.voice_hours / 24)} whole days in calls together` : ""}.</p>
          </div>
        </div>
        </div>`;
    },
  },
  {
    id: "games",
    accent: "#f39a1f",
    icon: icons.gamepad,
    show: (s) => !!s.games?.top.length,
    render: (s) => {
      const full = s.games.source === "analytics";
      const n = `<b>${fmt(s.games.distinct)} ${s.games.distinct === 1 ? "game" : "games"}</b>`;
      const played = (g) => g.hours >= 1
        ? `${fmt(g.hours)} ${Math.round(g.hours) === 1 ? "HOUR" : "HOURS"}`
        : `${g.sessions} ${g.sessions === 1 ? "SESSION" : "SESSIONS"}`;
      return `
      <div class="games">
        <div class="servers-head">
          <div>${eyebrow(icons.gamepad, "Your favourite")}<h2 class="headline">Games</h2></div>
          <div>
            <p class="lede" style="max-width:34ch">${full
              ? `You played ${n}${s.games.hours >= 1 ? ` for <b>${fmt(s.games.hours)} hours</b>` : ""}. These were your favourites:`
              : `You played ${n} while hanging out in voice. These were your favourites:`}</p>
            ${doodles(icons.swords)}
          </div>
        </div>
        <div class="shelf">
          ${s.games.top.map((g, i) => `
            <div class="game">
              <div class="cover" data-game="${i}"><span class="letters">${esc(g.name.split(/[\s:]+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase())}</span></div>
              <span class="rank">#${i + 1}</span>
              <h3>${esc(g.name)}</h3>
              <small>${played(g)}</small>
            </div>`).join("")}
        </div>
        ${full ? "" : `<p class="note">Only counts games running while you were in a voice channel. Packages include full game history only if “Use data to improve Discord” was turned on.</p>`}
      </div>`;
    },
    mount(el, s, ctx) {
      ctx.art?.games.then((art) => {
        for (const box of el.querySelectorAll("[data-game]")) {
          const a = art.get(s.games.top[Number(box.dataset.game)]?.name);
          if (!a) continue;
          // Portrait Steam art fills the cover; otherwise the square app icon sits in the middle.
          swapInImage(box, a.cover, "art").then((ok) => ok || swapInImage(box, a.icon, "icon"));
        }
      });
    },
  },
  {
    id: "quests",
    accent: "#9a6de0",
    icon: icons.quest,
    show: () => true,
    render: (s) => `
      <div class="pair">
        ${cube(icons.quest)}
        <div>
          ${eyebrow(icons.quest, "Quests completed")}
          ${count(s.quests.completed)}
          <p class="lede">${s.quests.completed ? `You cleared <b>${s.quests.completed} ${s.quests.completed === 1 ? "quest" : "quests"}</b> this year.` : "No quests this year. You were busy with the real thing."}</p>
          ${doodles(icons.star)}
        </div>
      </div>`,
  },
  {
    // The card reveal ("Deco"), like the original: the card drops in face down and flips on Reveal.
    id: "deco",
    accent: (s) => theme(s.persona.id).card,
    icon: icons.card,
    show: () => true,
    render: (s, ctx) => `
      <div class="deco${ctx.revealed ? " open instant" : ""}">
        <div class="deco-title">${eyebrow(icons.flag, "Your checkpoint")}<h2 class="headline">Deco</h2></div>
        <div class="deco-card">${collectible(s, { revealed: ctx.revealed })}</div>
        <div class="deco-foot">
          <button class="btn" type="button" data-reveal>Reveal</button>
          <p class="deco-blurb">You're a <b>${esc(s.persona.name)}</b>. ${esc(s.persona.blurb)}</p>
        </div>
      </div>`,
    mount(el, s, ctx) {
      const deco = el.querySelector(".deco");
      el.querySelector("[data-reveal]").addEventListener("click", () => {
        ctx.revealed = true;
        deco.classList.add("open");
        el.querySelector(".collectible").classList.add("revealed");
      });
    },
  },
  {
    id: "summary",
    accent: (s) => theme(s.persona.id).card,
    icon: icons.flag,
    show: () => true,
    render: (s, ctx) => {
      const item = (icon, label, value, text = false) =>
        `<div><small>${icon}${label}</small><span class="${text ? "text" : ""}">${value}</span></div>`;
      const fav = s.emojis.top[0];
      return `
        <div class="summary">
          ${collectible(s, { revealed: true, static: true })}
          <div>
            ${eyebrow(icons.flag, "Your checkpoint")}
            <h2 class="headline">Summary</h2>
            <div class="summary-grid">
              ${item(icons.chat, "Messages sent", fmt(s.messages.total))}
              ${s.voice ? item(icons.mic, "Hours in voice", fmt(s.voice.hours)) : ""}
              ${item(icons.smile, "Emojis used", fmt(s.emojis.total))}
              ${fav ? item(icons.star, "Favourite emoji", `<span style="display:inline-flex;width:28px;height:28px;vertical-align:middle">${emojiHtml(fav, ctx).replace("<img ", '<img style="width:28px;height:28px;object-fit:contain" ')}</span>`, true) : ""}
              ${s.games?.top[0] ? item(icons.gamepad, "Most played game", esc(s.games.top[0].name), true) : ""}
              ${s.servers[0] ? item(icons.servers, "Top server", esc(s.servers[0].name), true) : ""}
            </div>
            <div class="summary-actions">
              <button class="btn" type="button" data-save>${icons.download} Save image</button>
              <button class="btn ghost" type="button" data-restart>Start over</button>
            </div>
          </div>
        </div>`;
    },
  },
];
