from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

APP_DIR = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(APP_DIR))
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
server.daemon_threads = True
port = server.server_address[1]
url = f"http://127.0.0.1:{port}/"
print(f"RetroRadtv is running at {url}")
print("Keep this window open while using the app. Press Ctrl+C here to stop it.")
threading.Timer(0.7, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nRetroRadtv local server stopped.")
finally:
    server.server_close()
