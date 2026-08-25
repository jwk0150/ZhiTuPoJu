"""Static dev server for frontend/ that disables all browser caching.

Usage: python serve_nocache.py
Serves the frontend/ directory on http://localhost:8080 with
Cache-Control: no-store so browsers always fetch fresh files.
"""
import http.server
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')
os.chdir(ROOT)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


PORT = 8080
httpd = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), NoCacheHandler)
print('Serving %s on http://localhost:%d (no-cache)' % (ROOT, PORT))
httpd.serve_forever()
