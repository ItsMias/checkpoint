// Runs the whole analysis. Works in a Web Worker and in Node (for testing).
// The caller must have initialised the WASM module (`await init(...)`) first.

// Same version stamp as this module's own URL (see worker.js), so all of them come from one build.
const v = new URL(import.meta.url).search;
const { WasmEngine, wanted } = await import(`./pkg/engine.js${v}`);
const { listEntries, openEntry, readEntry } = await import(`./zip.js${v}`);

// Must match KINDS in engine/src/wasm.rs.
const K = { User: 0, MessagesIndex: 1, ServersIndex: 2, Quests: 3, ChannelMeta: 4, ChannelMessages: 5, Events: 6, EventsFallback: 7, Analytics: 8 };

// Server icons are only in the package for servers you manage. Read locally, never uploaded.
const SERVER_ICON = /^Servers\/(\d+)\/icon\.(png|jpe?g|gif|webp)$/i;
const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

/**
 * @param {Blob} blob            the data package zip
 * @param {{from:number,to:number}} window  Unix ms, [from, to)
 * @param {(p:{done:number,total:number,stage:string})=>void} onProgress
 * @returns {Promise<{stats:object, opened:string[], seconds:number, icons:Record<string,Blob>}>}
 */
export async function analyze(blob, window, onProgress = () => {}) {
  const t0 = Date.now();
  const entries = await listEntries(blob);

  const singles = [], events = [], fallback = [], analytics = [];
  const channels = new Map(); // folder -> { meta, messages }
  const iconEntries = new Map(); // guild id -> entry
  for (const e of entries) {
    const icon = SERVER_ICON.exec(e.name);
    if (icon) { iconEntries.set(icon[1], e); continue; }
    const kind = wanted(e.name);
    if (kind < 0) continue;
    if (kind === K.Events) events.push(e);
    else if (kind === K.EventsFallback) fallback.push(e);
    else if (kind === K.Analytics) analytics.push(e);
    else if (kind === K.ChannelMeta || kind === K.ChannelMessages) {
      const folder = e.name.slice(0, e.name.lastIndexOf("/"));
      const slot = channels.get(folder) ?? {};
      slot[kind === K.ChannelMeta ? "meta" : "messages"] = e;
      channels.set(folder, slot);
    } else singles.push({ e, kind });
  }
  if (!singles.some((s) => s.kind === K.User) && channels.size === 0) {
    throw new Error("This zip doesn't look like a Discord data package (no Account or Messages folder).");
  }

  const smallBytes = singles.reduce((n, s) => n + s.e.compressedSize, 0) +
    [...channels.values()].reduce((n, c) => n + (c.meta?.compressedSize ?? 0) + (c.messages?.compressedSize ?? 0), 0);
  const total = smallBytes + [...events, ...analytics].reduce((n, e) => n + e.compressedSize, 0);
  let done = 0;
  let lastReport = 0;
  const report = (stage, force) => {
    const now = Date.now();
    if (force || now - lastReport > 100) { lastReport = now; onProgress({ done, total, stage }); }
  };

  const engine = new WasmEngine(window.from, window.to);
  const opened = [];

  // 1. Account, indexes, quests. The user file goes first so the rest can refer to it.
  singles.sort((a, b) => (a.kind === K.User ? -1 : b.kind === K.User ? 1 : 0));
  for (const { e, kind } of singles) {
    engine.feed_file(kind, await readEntry(blob, e));
    opened.push(e.name);
    done += e.compressedSize;
  }

  // 2. Message folders, read a few at a time.
  report("messages", true);
  const folders = [...channels.values()].filter((c) => c.meta && c.messages);
  let next = 0;
  const worker = async () => {
    while (next < folders.length) {
      const c = folders[next++];
      const [meta, msgs] = await Promise.all([readEntry(blob, c.meta), readEntry(blob, c.messages)]);
      try { engine.feed_channel(meta, msgs); } catch { /* skip malformed folder */ }
      done += c.meta.compressedSize + c.messages.compressedSize;
      report("messages");
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  opened.push(`Messages/ (${folders.length} folders)`);

  // 3. Activity events: the big one, streamed.
  const stream = async (list, stage, feed) => {
    for (const e of list) {
      opened.push(e.name);
      const reader = (await openEntry(blob, e, (n) => { done += n; report(stage); })).getReader();
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        feed(value);
      }
      engine.finish_events();
    }
  };
  await stream(events, "activity", (c) => engine.feed_events(c));
  if (!engine.has_voice() && fallback.length) await stream(fallback, "activity", (c) => engine.feed_events(c));
  // 4. Full game history, only if the package has the opt-in analytics folder.
  await stream(analytics, "games", (c) => engine.feed_analytics(c));

  report("done", true);
  const stats = JSON.parse(engine.finish());
  stats.has_analytics = analytics.length > 0;

  const icons = {};
  for (const s of stats.servers) {
    const e = iconEntries.get(s.id);
    if (!e) continue;
    try {
      const ext = e.name.split(".").pop().toLowerCase();
      icons[s.id] = new Blob([await readEntry(blob, e)], { type: IMAGE_TYPES[ext] });
    } catch { /* fall back to the invite lookup */ }
  }
  return { stats, opened, icons, seconds: (Date.now() - t0) / 1000 };
}
