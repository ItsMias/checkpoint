#!/usr/bin/env bash
# Builds the Rust engine to WebAssembly into web/pkg/. The web/ folder is then the whole site.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"

cargo build --manifest-path engine/Cargo.toml --release --lib --target wasm32-unknown-unknown
wasm-bindgen --target web --no-typescript --out-dir web/pkg \
  engine/target/wasm32-unknown-unknown/release/engine.wasm
ls -lh web/pkg
