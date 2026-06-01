"""
Embeds y botones Discord — estética institucional peruana CEDIT.
"""
from __future__ import annotations

import datetime
import io
from typing import Optional

import discord

from cedit_links import (
    DISCORD_BOT_INVITE,
    DISCORD_SERVER_INVITE,
    TELEGRAM_BOT_URL,
    TELEGRAM_BOT_USERNAME,
    WEB_APP_COMING_SOON,
    WEB_APP_URL,
)
from discord_mentor import (
    build_panel_markdown,
    is_mentor_mode,
    mentor_chat_body,
    metrics_summary_lines,
    pdf_lock_reason,
    truncate_md,
)

# Colores bandera / MEF + gris Discord (secondary buttons)
PERU_RED = 0xAD0017
PERU_DARK_RED = 0x8B0000
PERU_GOLD = 0xD4AF37
PERU_WHITE = 0xF8F9FA
DISCORD_DARK = 0x2B2D31

FLAG_URL = "https://flagcdn.com/w80/pe.png"
BRAND_NAME = "Consejero Estatal Digital"
BRAND_HEADER = "🏛️ CEDIT"
SLOGAN = "Al servicio del Perú"


def format_query_timestamp(when: Optional[datetime.datetime] = None) -> str:
    when = when or datetime.datetime.now()
    return when.strftime("%d/%m/%Y %H:%M:%S")


def query_attribution_block(
    requested_by: Optional[discord.abc.User],
    queried_at: Optional[datetime.datetime] = None,
    query_preview: str = "",
) -> str:
    """Bloque visible: a quién responde el bot y cuándo preguntó."""
    if not requested_by:
        return ""
    name = requested_by.display_name or requested_by.name
    mention = requested_by.mention
    ts = format_query_timestamp(queried_at)
    block = f"👤 **Consulta de:** {name} ({mention})\n🕐 **Momento:** {ts}"
    preview = (query_preview or "").strip().replace("\n", " ")
    if preview:
        if len(preview) > 120:
            preview = preview[:117] + "…"
        block += f"\n💬 **Pregunta:** {preview}"
    return block


def _footer_text(requested_by: Optional[discord.abc.User] = None) -> str:
    try:
        now = datetime.datetime.now().strftime("%d/%m/%Y %I:%M %p")
    except ValueError:
        now = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    base = f"{BRAND_NAME} · {SLOGAN}"
    if requested_by:
        name = requested_by.display_name or requested_by.name
        return f"{base} · Solicitado por {name} · {now}"
    return f"{base} · {now}"


def apply_peru_branding(
    embed: discord.Embed,
    *,
    requested_by: Optional[discord.abc.User] = None,
    thumbnail: bool = True,
) -> discord.Embed:
    """Marca roja lateral, autor institucional y pie con usuario."""
    embed.color = PERU_RED
    embed.set_author(name=BRAND_HEADER, icon_url=FLAG_URL)
    if thumbnail:
        embed.set_thumbnail(url=FLAG_URL)
    embed.set_footer(text=_footer_text(requested_by))
    return embed


def peru_embed(
    description: str,
    *,
    requested_by: Optional[discord.abc.User] = None,
    title: Optional[str] = None,
    color: int = PERU_RED,
    thumbnail: bool = False,
) -> discord.Embed:
    e = discord.Embed(description=description, color=color)
    if title:
        e.title = title
    apply_peru_branding(e, requested_by=requested_by, thumbnail=thumbnail)
    return e


def welcome_embed(requested_by: Optional[discord.abc.User] = None) -> discord.Embed:
    """Menú /ayuda — texto completo; botones solo para acciones frecuentes."""
    description = (
        "¡Hola! 👋 Soy **CEDIT**, su **Consejero Estatal Digital**.\n\n"
        "💬 **Escriba `!` + su consulta** y le respondo en este hilo.\n\n"
        "**Atajos útiles**\n"
        "• `/ciudadano` — derechos y trámites del Estado\n"
        "• `/servidor` — planes y expedientes **MEF / Invierte.pe**\n"
        "• `/auditar` — guiar o auditar con texto\n"
        "• Adjunte **PDF** en el chat para auditar expediente\n"
        "• `/metricas` · `/expediente` · `/uso` · `/reiniciar_memoria`\n"
        "• `/conectar_wallet` — Plan Pro\n\n"
        "📥 **PDF oficial** desde **≥80%** de viabilidad · **Mis métricas** bajo demanda.\n"
        f"🌐 **Redes** — Discord, comunidad y [@{TELEGRAM_BOT_USERNAME}]({TELEGRAM_BOT_URL}) en Telegram."
    )
    return peru_embed(description, requested_by=requested_by, thumbnail=True)


def fresh_start_embed(requested_by: Optional[discord.abc.User] = None) -> discord.Embed:
    """Contexto limpio tras reinicio voluntario."""
    return peru_embed(
        "🧠 **Memoria reiniciada.** Empezamos con **contexto limpio**.\n\n"
        "Cuénteme su idea o proyecto **desde cero**; le iré guiando paso a paso "
        "como mentor MEF (validación, recomendaciones e impacto).\n\n"
        "📈 **Mis métricas** y **Ver expediente** — cuando usted quiera consultarlos.\n"
        "📥 **PDF oficial** — deshabilitado hasta alcanzar **≥80%** de viabilidad.\n\n"
        "Escriba **`!`** + su consulta para comenzar.",
        requested_by=requested_by,
        title="Nuevo inicio — CEDIT",
        thumbnail=True,
    )


def auto_reset_notice_embed(requested_by: Optional[discord.abc.User] = None) -> discord.Embed:
    """Aviso tras 24 h de inactividad en plan gratuito."""
    return peru_embed(
        "⏱️ Pasaron **24 horas** sin actividad en esta conversación (plan gratuito). "
        "Reinicié su memoria para empezar de cero.\n\n"
        "Cuénteme de nuevo su proyecto; le guiaré como mentor paso a paso.",
        requested_by=requested_by,
        title="Memoria reiniciada — 24 h",
        thumbnail=False,
    )


def document_received_embed(
    filename: str,
    page_count: int,
    char_count: int,
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed:
    e = discord.Embed(
        title="📄 Documento Recibido",
        description=(
            "¡He recibido tu archivo exitosamente!\n\n"
            f"**Archivo:** `{filename}`\n"
            f"**Páginas:** {page_count}\n"
            f"**Caracteres extraídos:** {char_count:,}\n\n"
            "Procederé a **revisar el expediente** según normativa **MEF / Invierte.pe** "
            "y te daré recomendaciones de mejora."
        ),
        color=PERU_RED,
    )
    return apply_peru_branding(e, requested_by=requested_by, thumbnail=True)


def document_review_embed(
    body: str,
    filename: str | None = None,
    opinion: str | None = None,
    strengths: str | None = None,
    findings_title: str = "Hallazgos",
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed:
    """Revisión de documento — estilo 📋 Revisión del expediente."""
    summary = body[:1800] if body else "—"
    if len(body) > 1800:
        summary += "\n\n… *(ver campos siguientes o mensaje completo)*"

    e = discord.Embed(
        title="📋 Revisión de Documento",
        description=(
            "**Análisis del Expediente**\n\n"
            f"{summary}"
        ),
        color=PERU_RED,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=True)

    if filename:
        e.add_field(name="📄 Archivo", value=f"`{filename}`", inline=True)
    if opinion:
        e.add_field(name="💬 Opinión de CEDIT", value=opinion[:1020], inline=False)
    if strengths:
        e.add_field(name=f"✅ {findings_title}", value=strengths[:1020], inline=False)
    elif body and "## dictamen" in body.lower():
        e.add_field(
            name=f"📌 {findings_title}",
            value="Ver dictamen técnico en el hilo o use `/plan` para el PDF oficial.",
            inline=False,
        )
    return e


def greeting_embed(requested_by: Optional[discord.abc.User] = None) -> discord.Embed:
    """Saludo corto antes de una respuesta en modo consulta."""
    return peru_embed(
        "**Buen día.**\n\n"
        "A continuación, mi orientación según la normativa vigente del Estado peruano:",
        requested_by=requested_by,
        thumbnail=False,
    )


def audit_bar_embed(
    usage: dict,
    mode: str = "audit",
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed:
    count = usage.get("count", 0)
    limit = usage.get("limit", 10)
    is_pro = usage.get("is_pro", False)

    if is_pro:
        bar = "██████████"
        status = "Plan **Pro** activo — memoria y trazabilidad habilitadas"
        color = PERU_GOLD
    else:
        pct = min(count / limit, 1.0) if isinstance(limit, int) and limit else 0
        filled = int(pct * 10)
        bar = "█" * filled + "░" * (10 - filled)
        remaining = usage.get("remaining", 0)
        if usage.get("freemium_exceeded"):
            status = f"Cupo de esta conversación agotado (**{count}/{limit}**). Use `/reiniciar_memoria`."
            color = PERU_DARK_RED
        else:
            status = f"Plan gratuito — **{count}/{limit}** auditorías · quedan **{remaining}** en este hilo"
            color = PERU_RED

    mode_label = {
        "audit": "Barra de auditoría MEF",
        "plan": "Barra de plan de inversión",
        "chat": "Sesión normativa",
    }.get(mode, "Estado de la conversación")

    e = discord.Embed(
        title=f"📊 {mode_label}",
        description=(
            f"**Buen día.** Registro de uso en esta conversación:\n\n"
            f"`{bar}`\n{status}"
        ),
        color=color,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=False)
    return e


def guide_graph_embed(
    guide_graph: dict,
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed:
    """Recorrido del grafo mentor (fase, nodos, completitud)."""
    phase = guide_graph.get("phase_name", "—")
    mentor = guide_graph.get("mentor_message", "")
    exp = guide_graph.get("completeness_pct", 0)
    prof = guide_graph.get("profile_completeness_pct", 0)
    trail = guide_graph.get("trail") or []
    trail_txt = " → ".join(trail[-5:]) if trail else "—"
    nodes = guide_graph.get("nodes") or []
    current = next((n for n in nodes if n.get("status") == "current"), None)
    node_label = current.get("label", phase) if current else phase

    lines = [
        f"**Fase:** {phase} · **Nodo:** {node_label}",
        f"**Expediente:** {exp}% · **Perfil:** {prof}%",
        f"_{mentor}_",
        f"`{trail_txt}`",
    ]
    if guide_graph.get("pdf_ready"):
        lines.append("\n✅ **Listo para Plan Técnico Oficial (PDF)**")

    crit = guide_graph.get("critical_items") or []
    pending = [c["label"].split("(")[0].strip()[:24] for c in crit if not c.get("collected")][:3]
    if pending:
        lines.append("\n**Foco datos:** " + ", ".join(pending))

    e = discord.Embed(
        title="🧭 Recorrido del mentor CEDIT",
        description="\n".join(lines),
        color=PERU_GOLD if guide_graph.get("pdf_ready") else PERU_RED,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=False)
    return e


def mentor_opinion_embed(
    result: dict,
    requested_by: Optional[discord.abc.User] = None,
    *,
    lead_note: str = "",
    pdf_filename: str = "",
    pdf_pages: int = 0,
) -> discord.Embed:
    """Opinión conversacional del mentor (parte corta, como el chat web)."""
    body = truncate_md(mentor_chat_body(result), 3500)
    if lead_note:
        note = lead_note if isinstance(lead_note, str) else str(lead_note)
        body = f"{note.strip()}\n\n{body}"
    mode = result.get("input_mode") or result.get("mode", "chat")
    title = {
        "audit": "💬 Mi opinión — CEDIT",
        "plan": "💬 Mi opinión — CEDIT",
        "chat": "🏛️ CEDIT",
    }.get(mode, "💬 CEDIT")

    e = discord.Embed(
        title=title,
        description=body,
        color=PERU_RED,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=False)
    if pdf_filename:
        pages_txt = f" · {pdf_pages} págs." if pdf_pages else ""
        e.add_field(name="📄 Expediente", value=f"`{pdf_filename}`{pages_txt}", inline=True)
    e.set_footer(text="CEDIT · /metricas · /expediente · PDF ≥80%")
    return e


def mentor_panel_embed(
    result: dict,
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed | None:
    """Checklist / avance — equivalente al panel desplegable web."""
    panel = build_panel_markdown(
        result.get("opinion", ""),
        result.get("response", ""),
    )
    if not panel:
        return None
    e = discord.Embed(
        title="📋 Expediente y avance",
        description=truncate_md(panel, 3500),
        color=PERU_GOLD,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=False)
    return e


def metrics_embed(
    result: dict,
    usage: dict | None = None,
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed:
    lines = metrics_summary_lines(result)
    if usage:
        if usage.get("is_pro"):
            lines.append(f"\n**Cupo hilo:** Pro ilimitado")
        else:
            lines.append(
                f"\n**Cupo hilo:** {usage.get('count', 0)}/{usage.get('limit', 10)} auditorías"
            )
    e = discord.Embed(
        title="📊 Mis métricas — plan MEF",
        description="\n".join(lines),
        color=PERU_GOLD if result.get("show_pdf") else PERU_RED,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=False)
    return e


def response_embed(
    body: str,
    mode: str = "chat",
    usage: dict | None = None,
    filename: str | None = None,
    opinion: str | None = None,
    strengths: str | None = None,
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed:
    if mode == "audit" and (opinion or strengths or filename):
        e = document_review_embed(
            body,
            filename=filename,
            opinion=opinion,
            strengths=strengths or None,
            requested_by=requested_by,
        )
        if usage:
            lim = usage.get("limit", 10)
            cnt = usage.get("count", 0)
            if usage.get("is_pro"):
                uso_txt = "💎 Pro — sin límite"
            else:
                uso_txt = f"**{cnt}/{lim}** auditorías en este hilo"
            e.add_field(name="📊 Cupo", value=uso_txt, inline=True)
        return e

    colors = {"chat": PERU_RED, "audit": PERU_RED, "plan": PERU_RED}
    if mode == "chat":
        content = body[:3600] if body else "—"
    else:
        intros = {
            "audit": "He revisado su expediente. Resumen:\n\n",
            "plan": "Respecto a su **plan de inversión**:\n\n",
        }
        intro = intros.get(mode, "")
        content = intro + (body[:3600] if body else "—")
    if len(body) > 3600:
        content += "\n\n… *(respuesta recortada por límite de Discord)*"

    e = discord.Embed(
        description=content,
        color=colors.get(mode, PERU_RED),
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=False)

    if filename:
        e.add_field(name="📄 Expediente", value=f"`{filename}`", inline=True)
    # Cupo solo con /uso o botón «Mi cupo», no en cada respuesta del chat

    return e


def freemium_blocked_embed(requested_by: Optional[discord.abc.User] = None) -> discord.Embed:
    e = discord.Embed(
        title="🔒 Límite de auditorías alcanzado",
        description=(
            "**Buen día.**\n\n"
            "Ha usado las **10 auditorías gratuitas** de esta conversación.\n\n"
            "• **Mejore su plan** con los datos que ya tiene y use **`/corregir`**\n"
            "• **Reinicie la memoria** con el botón o **`/reiniciar_memoria`** "
            "(perderá el progreso de este hilo, pero podrá seguir usando el agente)\n"
            "• **`/conectar_wallet`** — **Plan Pro** sin límite"
        ),
        color=PERU_DARK_RED,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=True)
    return e


class ResetMemoryConfirmView(discord.ui.View):
    """Confirmación antes de borrar memoria y cupo freemium."""

    def __init__(self, conv_key: tuple):
        super().__init__(timeout=120)
        self.conv_key = conv_key  # (channel_id, user_id, is_dm)

    @discord.ui.button(label="Sí, reiniciar memoria", style=discord.ButtonStyle.danger, emoji="🧠")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_guard import deny_if_not_owner
        from discord_session import get_session

        if await deny_if_not_owner(interaction, self.conv_key):
            return

        ch_id, user_id, is_dm = self.conv_key
        sess = get_session(ch_id, user_id, is_dm)
        sess.reset(voluntary=True)
        await interaction.response.edit_message(
            embed=fresh_start_embed(interaction.user),
            view=MainMenuView(),
        )

    @discord.ui.button(label="Cancelar", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_guard import deny_if_not_owner

        if await deny_if_not_owner(interaction, self.conv_key):
            return
        await interaction.response.edit_message(
            embed=peru_embed(
                "Operación cancelada. Su conversación y cupo **no** se modificaron.",
                requested_by=interaction.user,
            ),
            view=None,
        )


def pro_welcome_embed(
    wallet: str,
    persist: bool,
    requested_by: Optional[discord.abc.User] = None,
) -> discord.Embed:
    e = discord.Embed(
        description=(
            "**Buen día.**\n\n"
            "Su **Plan Pro** ha sido activado correctamente.\n\n"
            f"• Wallet: `{wallet[:16]}...`\n"
            f"• Guardar conversaciones: **{'Sí' if persist else 'No (modo privado)'}**\n"
            "• Auditorías **ilimitadas** y contexto entre sesiones"
        ),
        color=PERU_GOLD,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=True)
    return e


def thinking_embed(text: str = "Analizando su consulta…") -> discord.Embed:
    return peru_embed(f"⏳ {text}", thumbnail=False)


# --- Botones (estilo institucional: rojo / dorado) ---

def redes_embed(requested_by: Optional[discord.abc.User] = None) -> discord.Embed:
    web_line = (
        f"🌍 **Web CEDIT:** {WEB_APP_URL}"
        if WEB_APP_URL
        else f"🌍 **Web CEDIT:** {WEB_APP_COMING_SOON}"
    )
    description = (
        "**CEDIT en sus canales favoritos**\n\n"
        "Use los botones para **incorporar el bot a su servidor Discord**, "
        "**unirse a la comunidad** o **abrir el mentor en Telegram**.\n\n"
        f"✈️ **Telegram:** [@{TELEGRAM_BOT_USERNAME}]({TELEGRAM_BOT_URL})\n"
        f"{web_line}"
    )
    return peru_embed(description, requested_by=requested_by, title="🌐 Redes CEDIT", thumbnail=True)


class RedesView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=300)
        self.add_item(
            discord.ui.Button(
                label="Añadir bot a Discord",
                style=discord.ButtonStyle.link,
                url=DISCORD_BOT_INVITE,
                emoji="🤖",
            )
        )
        self.add_item(
            discord.ui.Button(
                label="Servidor comunitario",
                style=discord.ButtonStyle.link,
                url=DISCORD_SERVER_INVITE,
                emoji="👥",
            )
        )
        self.add_item(
            discord.ui.Button(
                label=f"Telegram @{TELEGRAM_BOT_USERNAME}",
                style=discord.ButtonStyle.link,
                url=TELEGRAM_BOT_URL,
                emoji="✈️",
            )
        )


class MainMenuView(discord.ui.View):
    """Acciones rápidas: rojo (principal) + gris Discord (secundario)."""

    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Auditar PDF",
        style=discord.ButtonStyle.danger,
        emoji="📄",
        custom_id="cedit:btn_auditar",
        row=0,
    )
    async def btn_auditar(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "Adjunte su **plan o expediente en PDF** en este canal.\n\n"
                "Use **Mis métricas** cuando quiera ver avance.",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Redes",
        style=discord.ButtonStyle.secondary,
        emoji="🌐",
        custom_id="cedit:btn_redes",
        row=0,
    )
    async def btn_redes(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=redes_embed(requested_by=interaction.user),
            view=RedesView(),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Mis métricas",
        style=discord.ButtonStyle.secondary,
        emoji="📈",
        custom_id="cedit:btn_metricas",
        row=0,
    )
    async def btn_metricas(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_session import get_session

        is_dm = isinstance(interaction.channel, discord.DMChannel)
        sess = get_session(interaction.channel_id, interaction.user.id, is_dm)
        mentor = sess.get_mentor_result()
        if not mentor:
            await interaction.response.send_message(
                embed=peru_embed(
                    "Aún no hay métricas de plan. Cuente su idea o adjunte un **PDF** "
                    "y el mentor irá registrando fase, índice MEF y riesgo.",
                    requested_by=interaction.user,
                ),
                ephemeral=True,
            )
            return
        await interaction.response.send_message(
            embed=metrics_embed(mentor, sess.usage(), requested_by=interaction.user),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Mi cupo",
        style=discord.ButtonStyle.secondary,
        emoji="📊",
        custom_id="cedit:btn_uso",
        row=0,
    )
    async def btn_uso(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_session import get_session
        is_dm = isinstance(interaction.channel, discord.DMChannel)
        sess = get_session(interaction.channel_id, interaction.user.id, is_dm)
        await interaction.response.send_message(
            embed=audit_bar_embed(sess.usage(), sess.mode, requested_by=interaction.user),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Reiniciar memoria",
        style=discord.ButtonStyle.secondary,
        emoji="🧠",
        custom_id="cedit:btn_reset",
        row=0,
    )
    async def btn_reset(self, interaction: discord.Interaction, button: discord.ui.Button):
        is_dm = isinstance(interaction.channel, discord.DMChannel)
        key = (interaction.channel_id, interaction.user.id, is_dm)
        await interaction.response.send_message(
            embed=peru_embed(
                "**¿Reiniciar memoria?**\n\n"
                "Su progreso en **esta conversación** se perderá (historial y barra de auditoría), "
                "pero podrá seguir usando el agente con cupo renovado.\n\n"
                "Confirme abajo o use **`/reiniciar_memoria`**.",
                requested_by=interaction.user,
                title="🧠 Reiniciar memoria",
            ),
            view=ResetMemoryConfirmView(key),
            ephemeral=True,
        )


class MentorActionView(discord.ui.View):
    """Acciones tras respuesta del mentor — PDF solo ≥80%, métricas, expediente."""

    def __init__(self, conv_key: tuple, show_pdf: bool = False, has_plan: bool = False):
        super().__init__(timeout=3600)
        self.conv_key = conv_key
        self.show_pdf = show_pdf
        self.has_plan = has_plan
        for child in self.children:
            label = getattr(child, "label", "")
            if label == "PDF oficial MEF":
                child.disabled = not show_pdf
            elif label == "Corregir plan":
                child.disabled = not has_plan

    @discord.ui.button(
        label="PDF oficial MEF",
        style=discord.ButtonStyle.danger,
        emoji="📥",
        row=0,
        disabled=True,
    )
    async def gen_pdf(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_guard import deny_if_not_owner

        if await deny_if_not_owner(interaction, self.conv_key):
            return
        if not self.show_pdf:
            return
        await interaction.response.defer(ephemeral=True, thinking=True)
        from discord_session import get_session
        from cedit_core import generate_plan_pdf, FreemiumLimitError

        ch_id, user_id, is_dm = self.conv_key
        sess = get_session(ch_id, user_id, is_dm)
        content = sess.get_plan()
        if not content:
            await interaction.followup.send("No hay plan en esta conversación. Siga guiando su idea con el mentor.", ephemeral=True)
            return
        try:
            sess.check_freemium("plan")
            meta = sess.get_audit_meta()
            pdf_bytes, filename, doc_hash, _ = generate_plan_pdf(
                content,
                title=f"Plan MEF — {sess.get_filename() or 'CEDIT'}",
                project_name=sess.get_filename().replace(".pdf", "") if sess.get_filename() else "Proyecto CEDIT",
                history=sess.history,
                user_id=f"discord_{user_id}",
                skip_usage=True,
                audit_opinion=meta.get("opinion", ""),
                audit_dictamen=meta.get("dictamen", ""),
                source_document=meta.get("source_excerpt", ""),
            )
            sess.increment_audit("plan")
            await interaction.followup.send(
                embed=peru_embed(
                    f"**Plan técnico oficial MEF** generado.\n\n🔗 `{doc_hash}`",
                    requested_by=interaction.user,
                ),
                file=discord.File(io.BytesIO(pdf_bytes), filename=filename),
            )
        except FreemiumLimitError:
            await interaction.followup.send(
                embed=freemium_blocked_embed(interaction.user),
                view=ResetMemoryConfirmView(self.conv_key),
                ephemeral=True,
            )
        except Exception as ex:
            await interaction.followup.send(f"Error al generar PDF: {ex}", ephemeral=True)

    @discord.ui.button(
        label="Mis métricas",
        style=discord.ButtonStyle.secondary,
        emoji="📈",
        row=0,
    )
    async def metrics(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_guard import deny_if_not_owner
        from discord_session import get_session

        if await deny_if_not_owner(interaction, self.conv_key):
            return

        ch_id, user_id, is_dm = self.conv_key
        sess = get_session(ch_id, user_id, is_dm)
        mentor = sess.get_mentor_result()
        if not mentor:
            await interaction.response.send_message(
                embed=peru_embed("Aún no hay métricas. Siga conversando con el mentor.", requested_by=interaction.user),
                ephemeral=True,
            )
            return
        await interaction.response.send_message(
            embed=metrics_embed(mentor, sess.usage(), requested_by=interaction.user),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Ver expediente",
        style=discord.ButtonStyle.secondary,
        emoji="📋",
        row=0,
    )
    async def panel(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_guard import deny_if_not_owner
        from discord_session import get_session

        if await deny_if_not_owner(interaction, self.conv_key):
            return

        ch_id, user_id, is_dm = self.conv_key
        sess = get_session(ch_id, user_id, is_dm)
        mentor = sess.get_mentor_result()
        if not mentor:
            await interaction.response.send_message(
                embed=peru_embed("Sin datos de expediente aún.", requested_by=interaction.user),
                ephemeral=True,
            )
            return
        panel = mentor_panel_embed(mentor, requested_by=interaction.user)
        trail = guide_graph_embed(mentor.get("guide_graph") or {}, requested_by=interaction.user)
        if panel and trail:
            merged = panel
            merged.description = f"{panel.description or ''}\n\n---\n\n{trail.description or ''}"[:4096]
            await interaction.response.send_message(embed=merged, ephemeral=True)
        elif panel:
            await interaction.response.send_message(embed=panel, ephemeral=True)
        else:
            await interaction.response.send_message(embed=trail, ephemeral=True)

    @discord.ui.button(
        label="Corregir plan",
        style=discord.ButtonStyle.secondary,
        emoji="✏️",
        row=0,
        disabled=True,
    )
    async def refine(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_guard import deny_if_not_owner

        if await deny_if_not_owner(interaction, self.conv_key):
            return
        if not self.has_plan:
            return
        await interaction.response.send_message(
            embed=peru_embed(
                "Use **`/corregir`** e indique los cambios. El mentor mantendrá el contexto del hilo.",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )


# Compatibilidad
PlanActionView = MentorActionView
