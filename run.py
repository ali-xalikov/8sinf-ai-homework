from __future__ import annotations

import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "3000"))


def _is_port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def main() -> None:
    import argparse

    p = argparse.ArgumentParser(description="8-sinf AI Homework — ishga tushirish")
    p.add_argument("--host", default=HOST,
                   help="Tinglanadigan interfeys. 0.0.0.0 -> LAN ichida barcha qurilmalar kira oladi")
    p.add_argument("--port", type=int, default=PORT)
    p.add_argument("--no-browser", action="store_true")
    p.add_argument("--setup", action="store_true", help="Dependency o'rnatadi (birinchi marta)")
    args = p.parse_args()

    if args.setup:
        import subprocess
        print("Dependency o'rnatilmoqda…")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])
        print("Tayyor. Endi `python run.py` deb yuguring.")
        return

    if not Path(ROOT / ".env").exists() and Path(ROOT / ".env.example").exists():
        Path(ROOT / ".env").write_text(Path(ROOT / ".env.example").read_text(encoding="utf-8"), encoding="utf-8")
        print("> .env fayli .env.example asosida yaratildi (saqlanadi, o'zgartirsangiz chiroyli).")

    if _is_port_busy(args.port):
        print(f"Port {args.port} band. Boshqa port bering: python run.py --port 3001")
        webbrowser.open(f"http://127.0.0.1:{args.port}")
        return

    if not args.no_browser:
        threading.Timer(1.8, lambda: webbrowser.open(f"http://127.0.0.1:{args.port}/")).start()

    print("=" * 62)
    print("  📚 8-sinf AI Homework  |  ko'p foydalanuvchili platforma")
    print("  Mahalliy ulanish:  http://127.0.0.1:%d" % args.port)
    if args.host in ("0.0.0.0", ""):
        hostname = socket.gethostname()
        try:
            ips = sorted({addrs[-1][0] for addrs in socket.getaddrinfo(hostname, None)
                          if addrs[0].name == socket.AF_INET})
        except Exception:
            ips = []
        for ip in ips:
            if not ip.startswith("127."):
                print(f"  Tarmoqda:         http://{ip}:{args.port}  (telefon/planshet orqali)")
    print("=" * 62)

    import uvicorn

    uvicorn.run("app.main:app", host=args.host, port=args.port, app_dir=str(BACKEND), reload=False)


if __name__ == "__main__":
    main()