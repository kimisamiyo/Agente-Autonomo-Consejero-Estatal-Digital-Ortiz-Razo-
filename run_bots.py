"""
Arranca Discord y Telegram en el mismo contenedor/VM (despliegue).
Si un proceso termina, el otro sigue hasta que cierres el servicio.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROCS: list[subprocess.Popen] = []


def _start(script: str) -> subprocess.Popen | None:
    path = ROOT / script
    if not path.is_file():
        print(f"[run_bots] No existe {script}", file=sys.stderr)
        return None
    print(f"[run_bots] Iniciando {script} ...")
    return subprocess.Popen(
        [sys.executable, str(path)],
        cwd=str(ROOT),
        env=os.environ.copy(),
    )


def _shutdown(*_args):
    for p in PROCS:
        if p.poll() is None:
            p.terminate()
    for p in PROCS:
        try:
            p.wait(timeout=15)
        except subprocess.TimeoutExpired:
            p.kill()


def main() -> int:
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    for script in ("telegram_bot.py", "bot.py"):
        proc = _start(script)
        if proc is not None:
            PROCS.append(proc)

    if not PROCS:
        print("[run_bots] Nada que ejecutar.", file=sys.stderr)
        return 1

    exit_code = 0
    while PROCS:
        for p in list(PROCS):
            code = p.poll()
            if code is not None:
                print(f"[run_bots] {p.args[-1]} terminó con código {code}")
                PROCS.remove(p)
                if code != 0:
                    exit_code = code
        if PROCS:
            try:
                PROCS[0].wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
