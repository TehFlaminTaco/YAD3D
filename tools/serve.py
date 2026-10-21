#!/usr/bin/env python3
"""Static file server with correct module/wasm MIME types: python3 tools/serve.py [port]"""
import http.server, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
http.server.ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
