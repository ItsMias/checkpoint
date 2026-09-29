// Runs the browser pipeline (web/analyze.js + WASM) in Node against a real package.
// Usage: node tools/node-test.mjs <package.zip> [YYYY-MM-DD to]
import { openAsBlob, readFileSync } from "node:fs";
import init from "../web/pkg/engine.js";
import { analyze } from "../web/analyze.js";

const [path, to = "2025-12-01"] = process.argv.slice(2);
await init({ module_or_path: readFileSync(new URL("../web/pkg/engine_bg.wasm", import.meta.url)) });

const blob = await openAsBlob(path);
let lastPct = -10;
const { stats, opened, seconds } = await analyze(
  blob,
  { from: Date.UTC(2025, 0, 1), to: Date.parse(to + "T00:00:00Z") },
  ({ done, total, stage }) => {
    const pct = Math.floor((done / total) * 100);
    if (pct >= lastPct + 10) { lastPct = pct; console.error(`${pct}% ${stage}`); }
  },
);

console.error("opened:\n  " + opened.join("\n  "));
console.log(JSON.stringify({
  seconds,
  messages: stats.messages.total,
  emojis: stats.emojis.total,
  topEmoji: stats.emojis.top.map((e) => e.text ?? `:${e.name}:`),
  voiceHours: Math.round(stats.voice?.hours ?? 0),
  servers: stats.servers.map((s) => s.name),
  sidekick: stats.squad[0]?.username,
  games: stats.games?.top.map((g) => `${g.name} ${g.sessions}`),
  quests: stats.quests.completed,
  persona: stats.persona.name,
}, null, 1));
