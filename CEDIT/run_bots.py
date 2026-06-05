"""
Arranca Discord (y opcionalmente Telegram).

Fly (por defecto): solo Discord en un proceso hijo — evita bloquear slash commands.
Local: ambos bots si hay tokens (modo unificado o CEDIT_BOTS_SUBPROCESS=1).
"""
from __future__ import annotations

import asyncio
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

ROOT = Path(__file__).resolve().parent
CHILDREN: dict[str, subprocess.Popen] = {}
SHUTTING_DOWN = False
_STOP = asyncio.Event()


def _fly_discord_only() -> bool:
    return os.getenv("CEDIT_FLY_DISCORD_ONLY", "").strip().lower() in ("1", "true", "yes")


def _use_subprocess() -> bool:
    return os.getenv("CEDIT_BOTS_SUBPROCESS", "").strip().lower() in ("1", "true", "yes")


def _has_discord() -> bool:
    return bool(os.getenv("DISCORD_TOKEN", "").strip())


def _has_telegram() -> bool:
    return bool(os.getenv("TELEGRAM_BOT_TOKEN", "").strip())


def _start(script: str) -> subprocess.Popen | None:
    path = ROOT / script
    if not path.is_file():
        print(f"[run_bots] No existe {script}", file=sys.stderr)
        return None
    print(f"[run_bots] Iniciando {script} ...", flush=True)
    return subprocess.Popen(
        [sys.executable, str(path)],
        cwd=str(ROOT),
        env=os.environ.copy(),
    )


def _shutdown_subprocess(*_args):
    global SHUTTING_DOWN
    SHUTTING_DOWN = True
    for proc in list(CHILDREN.values()):
        if proc.poll() is None:
            proc.terminate()
    for proc in list(CHILDREN.values()):
        try:
            proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            proc.kill()


def _scripts_to_run() -> list[str]:
    scripts: list[str] = []
    if _has_discord():
        scripts.append("bot.py")
    else:
        print("[run_bots] Sin DISCORD_TOKEN — omitiendo Discord", flush=True)
    if not _fly_discord_only() and _has_telegram():
        scripts.append("telegram_bot.py")
    elif _fly_discord_only() and _has_telegram():
        print(
            "[run_bots] Telegram omitido en Fly (CEDIT_FLY_DISCORD_ONLY). "
            "Use scripts\\3-CEDIT-Telegram.bat en su PC.",
            flush=True,
        )
    elif not _has_telegram():
        print("[run_bots] Sin TELEGRAM_BOT_TOKEN — omitiendo Telegram", flush=True)
    return scripts


def _main_subprocess() -> int:
    signal.signal(signal.SIGINT, _shutdown_subprocess)
    signal.signal(signal.SIGTERM, _shutdown_subprocess)

    scripts = _scripts_to_run()
    if not scripts:
        print("[run_bots] No hay tokens en secrets.", file=sys.stderr)
        return 1

    for script in scripts:
        proc = _start(script)
        if proc is not None:
            CHILDREN[script] = proc

    while not SHUTTING_DOWN:
        for script in list(CHILDREN.keys()):
            proc = CHILDREN[script]
            code = proc.poll()
            if code is None:
                continue
            if SHUTTING_DOWN:
                del CHILDREN[script]
                continue
            print(f"[run_bots] {script} terminó (código {code}), reinicio en 5s ...", flush=True)
            time.sleep(5)
            if SHUTTING_DOWN:
                break
            new_proc = _start(script)
            if new_proc is not None:
                CHILDREN[script] = new_proc
            else:
                del CHILDREN[script]
        time.sleep(3)

    _shutdown_subprocess()
    return 0


def _request_stop(*_args):
    global SHUTTING_DOWN
    SHUTTING_DOWN = True
    _STOP.set()


async def _supervise(name: str, coro_factory) -> None:
    while not SHUTTING_DOWN:
        try:
            await coro_factory()
        except asyncio.CancelledError:
            break
        except Exception as ex:
            print(f"[run_bots] {name} error: {ex!r}", flush=True)
        if SHUTTING_DOWN:
            break
        print(f"[run_bots] {name} reinicio en 5s ...", flush=True)
        try:
            await asyncio.wait_for(_STOP.wait(), timeout=5.0)
            break
        except asyncio.TimeoutError:
            pass


async def _main_unified() -> int:
    tasks: list[asyncio.Task] = []
    if _has_discord():
        from bot import run_discord

        tasks.append(asyncio.create_task(_supervise("discord", run_discord), name="discord"))
    if _has_telegram():
        from telegram_bot import run_telegram

        async def _tg():
            await run_telegram(_STOP)

        tasks.append(asyncio.create_task(_supervise("telegram", _tg), name="telegram"))
    if not tasks:
        print("[run_bots] No hay tokens en secrets.", file=sys.stderr)
        return 1
    print("[run_bots] Modo unificado (local)", flush=True)
    await asyncio.gather(*tasks, return_exceptions=True)
    return 0


def main() -> int:
    signal.signal(signal.SIGINT, _request_stop)
    signal.signal(signal.SIGTERM, _request_stop)

    if _fly_discord_only() or _use_subprocess():
        if _fly_discord_only():
            print("[run_bots] Fly: solo Discord (proceso dedicado)", flush=True)
        return _main_subprocess()

    try:
        return asyncio.run(_main_unified())
    finally:
        global SHUTTING_DOWN
        SHUTTING_DOWN = True


if __name__ == "__main__":
    raise SystemExit(main())
