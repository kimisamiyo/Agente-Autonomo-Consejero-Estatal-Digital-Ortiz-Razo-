"""
Embeds y botones Discord — estética institucional peruana CEDIT.
"""
from __future__ import annotations

import datetime
from typing import Optional

import discord

# Colores bandera / MEF
PERU_RED = 0xAD0017
PERU_DARK_RED = 0x8B0000
PERU_GOLD = 0xD4AF37
PERU_WHITE = 0xF8F9FA

FLAG_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Flag_of_Peru.svg/320px-Flag_of_Peru.png"
BRAND_NAME = "Consejero Estatal Digital"
BRAND_HEADER = "🇵🇪 🏛️ CEDIT"
SLOGAN = "Al servicio del Perú 🇵🇪"


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
    """Mensaje de bienvenida — estilo embed institucional (como capturas de referencia)."""
    description = (
        "¡Hola! 👋 Soy **CEDIT**, tu **Consejero Estatal Digital** — asesor público virtual "
        "al servicio del Perú.\n\n"
        "Te ayudo si eres **ciudadano(a)** (derechos y trámites) o **servidor(a) público(a)** "
        "(orientación de planes y expedientes para aprobación del **MEF**).\n\n"
        "💬 **Conversa conmigo**\n"
        "Escribe **`!`** seguido de tu consulta. Recuerdo el contexto de esta conversación "
        "para darte respuestas cada vez más útiles.\n\n"
        "👤 **Para Ciudadanos**\n"
        "Pregunta sobre derechos, procedimientos del Estado o normativa peruana. "
        "Te explico en palabras sencillas.\n\n"
        "🏛️ **Para Servidores Públicos**\n"
        "Envía tu plan o expediente en **`.pdf`** y verifico estructura y cumplimiento "
        "con normativa **MEF / Invierte.pe**.\n\n"
        "🧠 **Reiniciar conversación**\n"
        "Usa **`/reiniciar_memoria`** o el botón **Reiniciar** para borrar el contexto "
        "y recuperar tus **10 auditorías gratuitas** en este hilo."
    )
    return peru_embed(description, requested_by=requested_by, thumbnail=True)


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

    colors = {"chat": PERU_RED, "audit": PERU_RED, "plan": PERU_GOLD}
    intros = {
        "chat": "A continuación, mi orientación según la normativa vigente del Estado peruano:\n\n",
        "audit": "He revisado su expediente. Resumen:\n\n",
        "plan": "Respecto a su **plan de inversión**:\n\n",
    }
    intro = intros.get(mode, intros["chat"])
    content = intro + (body[:3600] if body else "—")
    if len(body) > 3600:
        content += "\n\n… *(respuesta recortada por límite de Discord)*"

    e = discord.Embed(
        title="💬 Consulta normativa" if mode == "chat" else None,
        description=content,
        color=colors.get(mode, PERU_RED),
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=mode == "chat")

    if filename:
        e.add_field(name="📄 Expediente", value=f"`{filename}`", inline=True)
    if usage and mode != "audit":
        lim = usage.get("limit", 10)
        cnt = usage.get("count", 0)
        uso_txt = "💎 Pro" if usage.get("is_pro") else f"**{cnt}/{lim}** auditorías"
        e.add_field(name="📊 Cupo", value=uso_txt, inline=True)

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
        from discord_session import get_session

        ch_id, user_id, is_dm = self.conv_key
        sess = get_session(ch_id, user_id, is_dm)
        sess.reset()
        embed = welcome_embed(interaction.user)
        embed.description = (
            "🧠 **Memoria reiniciada.** Su progreso en este hilo se borró; "
            "recuperó sus **auditorías gratuitas**.\n\n" + (embed.description or "")
        )
        await interaction.response.edit_message(embed=embed, view=MainMenuView())

    @discord.ui.button(label="Cancelar", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
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

class MainMenuView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Ciudadano",
        style=discord.ButtonStyle.danger,
        emoji="👤",
        custom_id="cedit:btn_ciudadano",
        row=0,
    )
    async def btn_ciudadano(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "**Buen día.**\n\n"
                "Modo **ciudadano(a)**. Escriba por ejemplo:\n"
                "`! ¿Qué derechos tengo ante el silencio administrativo?`",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Servidor público",
        style=discord.ButtonStyle.danger,
        emoji="🏛️",
        custom_id="cedit:btn_servidor",
        row=0,
    )
    async def btn_servidor(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "**Buen día.**\n\n"
                "Modo **servidor(a) público(a)**. Adjunte un **PDF** o escriba:\n"
                "`! Necesito auditar mi plan para Invierte.pe y el MEF`",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Auditar PDF",
        style=discord.ButtonStyle.primary,
        emoji="📄",
        custom_id="cedit:btn_auditar",
        row=0,
    )
    async def btn_auditar(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "**Buen día.**\n\n"
                "Adjunte su **plan o expediente en PDF** en este canal. "
                "Activaré la **barra de auditoría MEF** automáticamente.",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Mi cupo",
        style=discord.ButtonStyle.secondary,
        emoji="📊",
        custom_id="cedit:btn_uso",
        row=1,
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
        row=1,
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

    @discord.ui.button(
        label="Plan Pro",
        style=discord.ButtonStyle.success,
        emoji="💎",
        custom_id="cedit:btn_pro",
        row=1,
    )
    async def btn_pro(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "**Buen día.**\n\n"
                "Active **Plan Pro** con **`/conectar_wallet`** "
                "(prueba: escriba `demo` como wallet).",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )


class PlanActionView(discord.ui.View):
    def __init__(self, show_pdf: bool = True):
        super().__init__(timeout=3600)
        self.show_pdf = show_pdf

    @discord.ui.button(
        label="PDF oficial MEF",
        style=discord.ButtonStyle.danger,
        emoji="📥",
    )
    async def gen_pdf(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "Generando documento técnico… Si no aparece, use **`/plan`**.",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Corregir plan",
        style=discord.ButtonStyle.primary,
        emoji="✏️",
    )
    async def refine(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "Use **`/corregir`** e indique los cambios que requiere en su plan.",
                requested_by=interaction.user,
            ),
            ephemeral=True,
        )

    @discord.ui.button(
        label="Barra auditoría",
        style=discord.ButtonStyle.secondary,
        emoji="📊",
    )
    async def bar(self, interaction: discord.Interaction, button: discord.ui.Button):
        from discord_session import get_session
        is_dm = isinstance(interaction.channel, discord.DMChannel)
        sess = get_session(interaction.channel_id, interaction.user.id, is_dm)
        await interaction.response.send_message(
            embed=audit_bar_embed(sess.usage(), sess.mode, requested_by=interaction.user),
            ephemeral=True,
        )
