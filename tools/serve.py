#!/usr/bin/env python3
"""Dev server for web/, like `python3 -m http.server`, but every response says `Cache-Control: no-cache`
so the browser revalidates each file and never runs a stale script or engine after a rebuild.

Usage: python3 tools/serve.py [port] [directory]   (defaults: 8791, the web/ folder next to tools/)
"""
import functools
import http.server
import pathlib
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm", ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
root = sys.argv[2] if len(sys.argv) > 2 else str(pathlib.Path(__file__).resolve().parent.parent / "web")
print(f"Serving {root} at http://127.0.0.1:{port}", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoCache, directory=root)).serve_forever()
