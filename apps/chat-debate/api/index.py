"""Vercel entrypoint for the existing dialogue HTTP handler."""
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from server.dev_api import Handler

class handler(Handler):
    def do_GET(self):
        self.path = urlsplit(self.path).path
        super().do_GET()

    def do_POST(self):
        self.path = urlsplit(self.path).path
        super().do_POST()

