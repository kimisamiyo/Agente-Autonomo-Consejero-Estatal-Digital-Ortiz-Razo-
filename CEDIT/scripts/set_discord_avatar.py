"""
Aplica el avatar institucional CEDIT al bot de Discord (una sola vez o al reiniciar).
Uso: python scripts/set_discord_avatar.py
Requiere DISCORD_TOKEN en .env
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

AVATAR_PATH = ROOT / "assets" / "cedit-discord-avatar.png"


async def main():
    import discord

    token = os.getenv("DISCORD_TOKEN")
    if not token:
        print("ERROR: DISCORD_TOKEN no encontrado en .env")
        sys.exit(1)
    if not AVATAR_PATH.is_file():
        print(f"ERROR: No existe {AVATAR_PATH}")
        sys.exit(1)

    intents = discord.Intents.default()
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        data = AVATAR_PATH.read_bytes()
        await client.user.edit(avatar=data)
        print(f"Avatar actualizado para {client.user} ({len(data)} bytes)")
        await client.close()

    await client.start(token)


if __name__ == "__main__":
    asyncio.run(main())
