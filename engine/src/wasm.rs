//! JavaScript bindings (only compiled for wasm32).

use wasm_bindgen::prelude::*;

use crate::{Engine, Entry};

const KINDS: [Entry; 9] = [
    Entry::User,
    Entry::MessagesIndex,
    Entry::ServersIndex,
    Entry::Quests,
    Entry::ChannelMeta,
    Entry::ChannelMessages,
    Entry::Events,
    Entry::EventsFallback,
    Entry::Analytics,
];

/// Entry kind codes shared with `web/analyze.js`: index into `KINDS`, or -1 for "don't read".
#[wasm_bindgen]
pub fn wanted(path: &str) -> i32 {
    crate::wanted(path).map_or(-1, |k| KINDS.iter().position(|x| *x == k).unwrap() as i32)
}

#[wasm_bindgen]
pub struct WasmEngine(Engine);

#[wasm_bindgen]
impl WasmEngine {
    /// Window in Unix milliseconds, `[from_ms, to_ms)`.
    #[wasm_bindgen(constructor)]
    pub fn new(from_ms: f64, to_ms: f64) -> WasmEngine {
        WasmEngine(Engine::new(from_ms as i64, to_ms as i64))
    }

    pub fn feed_file(&mut self, kind: i32, bytes: &[u8]) -> Result<(), JsError> {
        let kind = *KINDS.get(kind as usize).ok_or_else(|| JsError::new("bad entry kind"))?;
        self.0.feed_file(kind, bytes).map_err(|e| JsError::new(&e))
    }

    pub fn feed_channel(&mut self, channel_json: &[u8], messages_json: &[u8]) -> Result<(), JsError> {
        self.0.feed_channel(channel_json, messages_json).map_err(|e| JsError::new(&e))
    }

    pub fn feed_events(&mut self, chunk: &[u8]) {
        self.0.feed_events(chunk);
    }

    pub fn feed_analytics(&mut self, chunk: &[u8]) {
        self.0.feed_analytics(chunk);
    }

    pub fn finish_events(&mut self) {
        self.0.finish_events();
    }

    pub fn has_voice(&self) -> bool {
        self.0.has_voice()
    }

    /// Consumes the engine and returns the stats as JSON.
    pub fn finish(self) -> String {
        serde_json::to_string(&self.0.finish()).unwrap_or_else(|_| "{}".into())
    }
}
