"""
Bot Telegram CEDIT — long polling directo (sin túnel ni webhook).

Requisito: TELEGRAM_BOT_TOKEN en .env (token de @BotFather).
Ejecutar: python telegram_bot.py
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ParseMode
from telegram.error import BadRequest
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from telegram_handler import TelegramReply, process_document_message, process_text_message

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("cedit.telegram.bot")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

SLASH_TO_TEXT = {
    "start": "AYUDA",
    "ayuda": "AYUDA",
    "help": "AYUDA",
    "metricas": "METRICAS",
    "metrica": "METRICAS",
    "fase": "FASE",
    "expediente": "EXPEDIENTE",
    "pdf": "PDF",
    "reiniciar": "REINICIAR",
}


async def _send_replies(update: Update, replies: list[TelegramReply]) -> None:
    msg = update.effective_message
    if not msg or not replies:
        return
    for reply in replies:
        try:
            await msg.reply_text(reply.text, parse_mode=ParseMode.MARKDOWN)
        except BadRequest:
            await msg.reply_text(reply.text)


async def _run_text(update: Update, text: str) -> None:
    chat_id = update.effective_chat.id
    replies = await asyncio.to_thread(process_text_message, chat_id, text)
    await _send_replies(update, replies)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _run_text(update, "AYUDA")


async def cmd_ayuda(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _run_text(update, "AYUDA")


async def cmd_metricas(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _run_text(update, "METRICAS")


async def cmd_fase(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _run_text(update, "FASE")


async def cmd_expediente(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _run_text(update, "EXPEDIENTE")


async def cmd_pdf(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _run_text(update, "PDF")


async def cmd_reiniciar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _run_text(update, "REINICIAR")


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    text = update.message.text.strip()
    if text.startswith("/"):
        cmd = text.split(maxsplit=1)[0].lstrip("/").split("@")[0].lower()
        mapped = SLASH_TO_TEXT.get(cmd)
        if mapped:
            text = mapped
    await _run_text(update, text)


async def on_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.document:
        return
    doc = update.message.document
    tg_file = await context.bot.get_file(doc.file_id)
    raw = await tg_file.download_as_bytearray()
    caption = update.message.caption or ""
    filename = doc.file_name or "expediente.pdf"
    chat_id = update.effective_chat.id
    replies = await asyncio.to_thread(
        process_document_message,
        chat_id,
        bytes(raw),
        filename,
        caption,
    )
    await _send_replies(update, replies)


def main() -> None:
    if not TOKEN:
        print("Falta TELEGRAM_BOT_TOKEN en .env")
        print("1. Abra Telegram y busque @BotFather")
        print("2. /newbot -> copie el token")
        print("3. En CEDIT/.env agregue: TELEGRAM_BOT_TOKEN=su_token")
        raise SystemExit(1)

    app = (
        Application.builder()
        .token(TOKEN)
        .build()
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("ayuda", cmd_ayuda))
    app.add_handler(CommandHandler("help", cmd_ayuda))
    app.add_handler(CommandHandler("metricas", cmd_metricas))
    app.add_handler(CommandHandler("fase", cmd_fase))
    app.add_handler(CommandHandler("expediente", cmd_expediente))
    app.add_handler(CommandHandler("pdf", cmd_pdf))
    app.add_handler(CommandHandler("reiniciar", cmd_reiniciar))
    app.add_handler(MessageHandler(filters.Document.ALL, on_document))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    log.info("CEDIT Telegram — polling activo. Escriba al bot en Telegram.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
