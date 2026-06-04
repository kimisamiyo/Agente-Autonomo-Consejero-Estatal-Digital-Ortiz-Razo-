"""
Formateo Telegram — reutiliza la lógica de WhatsApp (Markdown compatible).
"""
from whatsapp_formatter import (  # noqa: F401
    FOOTER,
    chunk_text,
    format_expediente,
    format_freemium_block,
    format_help,
    format_mentor_bubbles,
    format_metrics,
    format_pdf_status,
    format_phase,
    format_reset_confirm,
    format_reset_done,
    md_to_whatsapp,
)

md_to_telegram = md_to_whatsapp
