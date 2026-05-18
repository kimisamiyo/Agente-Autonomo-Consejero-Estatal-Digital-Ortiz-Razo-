"""
Actualiza nombre visible y avatar del bot en Discord.
Uso: python scripts/set_discord_profile.py
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

AVATAR_PATH = ROOT / "assets" / "cedit-discord-avatar.png"
DISPLAY_NAME = os.getenv("DISCORD_BOT_NAME", "CEDIT - Agent")


async def main():
    import discord

    token = os.getenv("DISCORD_TOKEN")
    if not token:
        print("ERROR: DISCORD_TOKEN no encontrado en .env")
        sys.exit(1)

    intents = discord.Intents.default()
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        kwargs = {"global_name": DISPLAY_NAME}
        if AVATAR_PATH.is_file():
            kwargs["avatar"] = AVATAR_PATH.read_bytes()
        await client.user.edit(**kwargs)
        print(f"Perfil actualizado: {DISPLAY_NAME} (@{client.user.name})")
        await client.close()

    await client.start(token)


if __name__ == "__main__":
    asyncio.run(main())
