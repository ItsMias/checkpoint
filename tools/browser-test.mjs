// End-to-end test in headless Chromium: loads a real package through the page's file input,
// waits for the recap, screenshots every card and lists every network request made.
// Usage: node tools/browser-test.mjs <chrome-headless-shell> <package.zip> <out-dir> [url] [--no-cdn]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [chrome, zip, out, url = "http://localhost:8791/"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const noCdn = process.argv.includes("--no-cdn");
mkdirSync(out, { recursive: true });

const proc = spawn(chrome, ["--no-sandbox", "--hide-scrollbars", "--remote-debugging-port=9333", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page"); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const requests = [];
const logs = [];
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
  if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + m.params.exceptionDetails.exception?.description);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const shot = async (name) => {
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${out}/${name}.png`, Buffer.from(result.data, "base64"));
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await send("Page.navigate", { url });
await sleep(1500);
if (noCdn) await evaluate(`document.getElementById("cdn").click()`);

const { root } = (await send("DOM.getDocument")).result;
const { nodeId } = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: "#file" })).result;
const t0 = Date.now();
await send("DOM.setFileInputFiles", { nodeId, files: [resolve(zip)] });

for (;;) {
  await sleep(500);
  if (await evaluate(`!!document.querySelector("[data-next]")`)) break;
  const err = await evaluate(`document.querySelector(".error")?.textContent`);
  if (err) { console.log("ERROR:", err); break; }
  if (Date.now() - t0 > 600_000) { console.log("TIMEOUT"); break; }
}
console.log(`processed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

for (let n = 0; n < 20; n++) {
  await sleep(700);
  if (await evaluate(`!!document.querySelector("[data-reveal]:not([hidden])")`)) {
    await shot(`card${String(n).padStart(2, "0")}a`);
    await evaluate(`document.querySelector("[data-reveal]").click()`);
    await sleep(700);
  }
  await shot(`card${String(n).padStart(2, "0")}`);
  const last = await evaluate(`document.getElementById("next").hidden && !document.querySelector("[data-next]")`);
  if (last) break;
  await evaluate(`(document.querySelector("[data-next]") ?? document.getElementById("next")).click()`);
}

const hosts = [...new Set(requests.map((u) => { try { return new URL(u).origin; } catch { return u.slice(0, 30); } }))];
console.log("request origins:", hosts);
console.log("console:", logs.filter((l) => !l.startsWith("[vite")).slice(0, 20));
ws.close();
proc.kill();
