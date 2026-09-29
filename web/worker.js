// Background thread: reads the zip and runs the WASM engine, so the page stays responsive.
//
// The page starts this as `worker.js?v=<stamp>` and the stamp is passed on to everything loaded
// here (engine, wasm, analyze.js, zip.js). Browsers can otherwise keep serving an old engine from
// cache long after it was rebuilt.
const v = self.location.search;

const ready = (async () => {
  const engine = await import(`./pkg/engine.js${v}`);
  await engine.default({ module_or_path: new URL(`./pkg/engine_bg.wasm${v}`, import.meta.url) });
  return (await import(`./analyze.js${v}`)).analyze;
})();

self.onmessage = async ({ data: { file, from, to } }) => {
  try {
    const analyze = await ready;
    const result = await analyze(file, { from, to }, (p) => self.postMessage({ type: "progress", ...p }));
    self.postMessage({ type: "done", ...result });
  } catch (err) {
    self.postMessage({ type: "error", message: err?.message ?? String(err) });
  }
};
