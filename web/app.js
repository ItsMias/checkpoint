// Page flow: landing (drop a zip) → processing → card player.

import { resolveArt } from "./art.js";
import { CARDS, esc, paintCanvases } from "./cards.js";
import { DEMO } from "./demo.js";
import { icons } from "./icons.js";
import { matrixRain } from "./matrix.js";
import * as music from "./music.js";
import { saveSummaryImage } from "./share.js";

/** Years the recap can cover, newest first. Stats cover the whole calendar year (or the year so far). */
const FIRST_YEAR = 2022;
const THIS_YEAR = new Date().getUTCFullYear();
const YEARS = Array.from({ length: THIS_YEAR - FIRST_YEAR + 1 }, (_, i) => THIS_YEAR - i);
const REPO = "https://github.com/ItsMias/checkpoint";
const yearWindow = (y) => ({ from: Date.UTC(y, 0, 1), to: Date.UTC(y + 1, 0, 1) });

const $ = (id) => document.getElementById(id);
const slides = $("slides");
const pips = $("pips");
const prevBtn = $("prev");
const nextBtn = $("next");
const closeBtn = $("close");
const musicBtn = $("music");

$("logo").innerHTML = `${icons.flag}<span>CHECKPOINT</span>`;
prevBtn.innerHTML = icons.left;
nextBtn.innerHTML = icons.right;
closeBtn.innerHTML = icons.close;

const paintMusic = (m) => {
  musicBtn.innerHTML = m ? icons.muted : icons.sound;
  musicBtn.setAttribute("aria-label", m ? "Turn music on" : "Turn music off");
  musicBtn.setAttribute("aria-pressed", String(!m));
};
paintMusic(music.isMuted());
music.onChange(paintMusic);
musicBtn.addEventListener("click", () => {
  music.setMuted(!music.isMuted());
  if (!music.isMuted()) music.play();
});

/** `art`: server icon / game art lookups for the current stats (see art.js). */
const ctx = { cdn: true, art: null };
let year = THIS_YEAR;
let deck = [];
let index = 0;
let stats = null;
let autoTimer = 0;
let worker = null;

const setAccent = (c) => document.documentElement.style.setProperty("--accent", c);

function swap(html) {
  for (const old of slides.children) {
    old.cleanup?.();
    old.cleanup = null;
    old.classList.remove("enter");
    old.classList.add("leave");
    setTimeout(() => old.remove(), 260);
  }
  const el = document.createElement("section");
  el.className = "slide enter";
  el.innerHTML = html;
  slides.append(el);
  return el;
}

// ---------- landing ----------

function landing(error = "") {
  clearTimeout(autoTimer);
  worker?.terminate();
  worker = null;
  stats = null;
  music.stop();
  releaseArt();
  setAccent("#3df07a");
  pips.innerHTML = "";
  prevBtn.hidden = nextBtn.hidden = closeBtn.hidden = true;

  const el = swap(`
    <div class="landing home">
      <h1 class="headline xl">Checkpoint</h1>
      <div class="lede">Look back at your ${yearPicker()} on Discord.</div>

      <div class="drop" id="drop">
        <p>Drop your <b>package.zip</b> here</p>
        <label class="btn">${icons.upload} Choose file<input type="file" id="file" accept=".zip,application/zip"></label>
        <p class="local-badge">${icons.lock}<span>Read on your device. Your data is never uploaded anywhere.</span></p>
      </div>
      ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}

      <div class="callout">
        <span class="callout-icon">${icons.check}</span>
        <div>
          <strong>Works with “Use data to improve Discord” turned off</strong>
          <p>Your year is rebuilt from the data every package includes, so it works either way. If the setting was on, your full game history is added too.</p>
        </div>
      </div>

      <label class="switch">
        <input type="checkbox" id="cdn" role="switch" ${ctx.cdn ? "checked" : ""}>
        <span class="track" aria-hidden="true"></span>
        <span class="switch-text">Show avatars, server icons and game art<small>Images load from Discord and Steam</small></span>
      </label>

      <div class="faq">
        <details>
          <summary>How do I get my data package?${icons.chevron}</summary>
          <ol>
            <li>Open Discord, then <b>User Settings → Data &amp; Privacy</b>.</li>
            <li>Choose <b>Request all of my data</b> and tick at least Account, Activity, Messages and Servers.</li>
            <li>Discord emails you a download link, usually within a few days.</li>
          </ol>
        </details>
        <details>
          <summary>What does this page read?${icons.chevron}</summary>
          <ul>
            <li>Your messages (only to count them and their emoji), servers, friends list and quests.</li>
            <li>The <b>Activity/reporting</b> log for voice time. If your package has the <b>analytics</b> folder, it's read for your full game history.</li>
            <li>With images on, Discord is asked for icons of your top servers and games (only their invite codes or names are sent). Nothing from your package is uploaded.</li>
            <li>Everything stays in this tab's memory and is gone when you close it.</li>
          </ul>
        </details>
        <details>
          <summary>How do I know this is safe?${icons.chevron}</summary>
          <ul>
            <li>The whole site is open source on <a href="${REPO}" target="_blank" rel="noopener noreferrer">GitHub</a>, so anyone can read exactly what it does with your package.</li>
            <li>Your zip is read inside your browser and never uploaded. You can check this yourself: open your browser's developer tools, go to the Network tab, and drop your package in.</li>
          </ul>
        </details>
      </div>

      <div class="or" aria-hidden="true"><span>or</span></div>
      <button class="btn ghost demo" type="button" id="demo">${icons.play} Try it with demo data</button>
    </div>`);

  const drop = el.querySelector("#drop");
  el.querySelector("#file").addEventListener("change", (e) => e.target.files[0] && run(e.target.files[0]));
  el.querySelector("#cdn").addEventListener("change", (e) => (ctx.cdn = e.target.checked));
  el.querySelector("#demo").addEventListener("click", () => {
    music.play();
    start({ ...DEMO, window: yearWindow(year) });
  });
  mountYearPicker(el);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    const f = e.dataTransfer.files[0];
    if (f) run(f);
  });
}

// ---------- year picker (a listbox styled as an inline chip) ----------

function yearPicker() {
  return `<span class="year-pick">
      <button type="button" class="year-btn" id="year-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="year-list">
        <span id="year-value">${year}</span>${icons.chevron}
      </button>
      <ul class="year-list" id="year-list" role="listbox" aria-label="Year" tabindex="-1">
        ${YEARS.map((y) => `<li role="option" data-year="${y}" aria-selected="${y === year}">${y}${icons.check}</li>`).join("")}
      </ul>
    </span>`;
}

function mountYearPicker(root) {
  const btn = root.querySelector("#year-btn");
  const list = root.querySelector("#year-list");
  const options = [...list.children];
  let active = YEARS.indexOf(year);

  const highlight = (i) => {
    active = (i + options.length) % options.length;
    options.forEach((o, n) => o.classList.toggle("active", n === active));
    options[active].scrollIntoView({ block: "nearest" });
  };
  const open = () => {
    btn.setAttribute("aria-expanded", "true");
    list.classList.add("open");
    highlight(YEARS.indexOf(year));
    list.focus({ preventScroll: true });
  };
  const close = (focus = true) => {
    btn.setAttribute("aria-expanded", "false");
    list.classList.remove("open");
    if (focus) btn.focus({ preventScroll: true });
  };
  const choose = (i) => {
    year = YEARS[i];
    root.querySelector("#year-value").textContent = year;
    options.forEach((o, n) => o.setAttribute("aria-selected", String(n === i)));
    close();
  };

  btn.addEventListener("click", () => (list.classList.contains("open") ? close() : open()));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
  });
  list.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-year]");
    if (li) choose(options.indexOf(li));
  });
  list.addEventListener("mousemove", (e) => {
    const li = e.target.closest("li[data-year]");
    if (li && options.indexOf(li) !== active) highlight(options.indexOf(li));
  });
  list.addEventListener("keydown", (e) => {
    const keys = { ArrowDown: () => highlight(active + 1), ArrowUp: () => highlight(active - 1),
      Home: () => highlight(0), End: () => highlight(options.length - 1),
      Enter: () => choose(active), " ": () => choose(active), Escape: () => close(), Tab: () => close(false) };
    if (keys[e.key]) { if (e.key !== "Tab") e.preventDefault(); keys[e.key](); }
  });
  list.addEventListener("focusout", (e) => {
    if (!root.querySelector(".year-pick").contains(e.relatedTarget)) close(false);
  });
}

// ---------- processing ----------

const STAGES = {
  messages: "Counting your messages…",
  activity: "Replaying your voice calls…",
  games: "Digging through your game history…",
  done: "Putting your cards together…",
};

function run(file) {
  music.play();
  const el = swap(`
    <div class="landing loading">
      <p class="eyebrow">${icons.flag} Loading checkpoint</p>
      <h2 class="headline">Rewinding</h2>
      <div class="progress" style="margin-top:28px">
        <div class="bar"><i id="bar"></i></div>
        <p class="note" id="stage" style="margin:0">Opening ${esc(file.name)}…</p>
      </div>
      <p class="note">Big packages take a minute. Everything is happening on your device.</p>
    </div>`);
  // The rain covers the whole page, header and footer included, behind everything.
  const rain = Object.assign(document.createElement("canvas"), { className: "matrix" });
  rain.setAttribute("aria-hidden", "true");
  $("stage").prepend(rain);
  const stopRain = matrixRain(rain);
  el.cleanup = () => {
    stopRain();
    rain.classList.add("out");
    setTimeout(() => rain.remove(), 300);
  };
  const bar = el.querySelector("#bar");
  const stage = el.querySelector("#stage");

  // A fresh URL each run, so the engine is never an old copy from the browser cache.
  worker = new Worker(`worker.js?v=${Date.now()}`, { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.type === "progress") {
      bar.style.width = `${Math.min(100, (data.done / data.total) * 100).toFixed(1)}%`;
      stage.textContent = `${STAGES[data.stage] ?? ""} ${Math.floor((data.done / data.total) * 100)}%`;
    } else if (data.type === "done") {
      worker.terminate();
      worker = null;
      console.info(`Checkpoint: analysed in ${data.seconds}s. Opened:`, data.opened);
      start(data.stats, data.icons);
    } else if (data.type === "error") {
      landing(data.message);
    }
  };
  worker.onerror = (e) => landing(e.message || "Something went wrong reading that file.");
  worker.postMessage({ file, ...yearWindow(year) });
}

// ---------- player ----------

function start(s, icons = {}) {
  releaseArt();
  stats = s;
  ctx.art = resolveArt(s, { cdn: ctx.cdn, icons });
  ctx.revealed = false;
  deck = CARDS.filter((c) => c.show(s));
  closeBtn.hidden = false;
  pips.innerHTML = deck
    .map((c, i) => (c.icon ? `<button type="button" data-i="${i}" aria-label="${c.id}">${c.icon}</button>` : ""))
    .join("");
  go(0);
}

function go(i) {
  clearTimeout(autoTimer);
  index = Math.max(0, Math.min(deck.length - 1, i));
  const card = deck[index];
  setAccent(typeof card.accent === "function" ? card.accent(stats) : card.accent);
  const el = swap(card.render(stats, ctx));
  paintCanvases(el);
  card.mount?.(el, stats, ctx);
  countUp(el);

  el.querySelector("[data-next]")?.addEventListener("click", () => go(index + 1));
  el.querySelector("[data-restart]")?.addEventListener("click", () => landing());
  el.querySelector("[data-save]")?.addEventListener("click", () => saveSummaryImage(stats));

  prevBtn.hidden = index === 0;
  nextBtn.hidden = index === deck.length - 1 || card.id === "intro";
  for (const b of pips.querySelectorAll("button")) {
    const n = Number(b.dataset.i);
    if (n === index) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
    b.classList.toggle("seen", n < index);
  }
  if (card.auto) autoTimer = setTimeout(() => go(index + 1), card.auto);
}

/** Frees the object URLs made for server icons read from the package. */
function releaseArt() {
  ctx.art?.servers.forEach((p) => p.then((r) => r?.icon?.startsWith("blob:") && URL.revokeObjectURL(r.icon)));
  ctx.art = null;
}

function countUp(root) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const el of root.querySelectorAll("[data-count]")) {
    const target = Number(el.dataset.count);
    if (reduce || target === 0) { el.textContent = String(target); continue; }
    const t0 = performance.now();
    const dur = 1300;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 4))));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

prevBtn.addEventListener("click", () => go(index - 1));
nextBtn.addEventListener("click", () => go(index + 1));
closeBtn.addEventListener("click", () => landing());
$("logo").addEventListener("click", () => landing());
pips.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (b) go(Number(b.dataset.i));
});
addEventListener("keydown", (e) => {
  if (!stats || e.target.closest?.("input, textarea")) return;
  if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(index + 1); }
  if (e.key === "ArrowLeft") go(index - 1);
  if (e.key === "Escape") landing();
});
let touchX = null;
slides.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
slides.addEventListener("touchend", (e) => {
  if (!stats || touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
  touchX = null;
});

// `?demo` opens the demo straight away; `&card=N` jumps to a card (handy for sharing and screenshots).
const params = new URLSearchParams(location.search);
if (YEARS.includes(Number(params.get("year")))) year = Number(params.get("year"));
if (params.has("demo")) {
  ctx.cdn = false;
  start({ ...DEMO, window: yearWindow(year) });
  if (params.has("card")) go(Number(params.get("card")));
} else {
  landing();
}
