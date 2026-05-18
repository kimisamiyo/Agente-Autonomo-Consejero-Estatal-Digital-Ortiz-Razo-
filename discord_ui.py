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
BRAND_HEADER = "🇵🇪 🏛️ Consejero Estatal Digital"
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
    now = datetime.datetime.now().strftime("%-d/%-m/%Y %-I:%M %p")
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
    """Mensaje de bienvenida — estilo del embed institucional peruano."""
    description = (
        "**Buen día.**\n\n"
        "¿Es usted **ciudadano(a)** y tiene dudas sobre trámites del Estado, "
        "o es **servidor(a) público(a)** y necesita orientación sobre "
        "**planes de inversión y proyectos** ante el **MEF**?\n\n"
        "• Como **ciudadano(a)**, le oriento en **derechos y trámites** con lenguaje claro.\n"
        "• Como **servidor(a) público(a)**, audito **planes en PDF** y verifico cumplimiento **Invierte.pe**.\n"
        "• Escriba **`!`** y su consulta, o use los **botones** de abajo.\n"
        "• **`/reiniciar_memoria`** borra esta conversación y recupera auditorías gratuitas."
    )
    return peru_embed(description, requested_by=requested_by, thumbnail=True)


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
    queried_at: Optional[datetime.datetime] = None,
    query_preview: str = "",
) -> discord.Embed:
    colors = {"chat": PERU_RED, "audit": PERU_RED, "plan": PERU_GOLD}

    attribution = query_attribution_block(requested_by, queried_at, query_preview)
    intros = {
        "chat": "**Buen día.**\n\n",
        "audit": "**Buen día.** He revisado su expediente. A continuación, mi análisis:\n\n",
        "plan": "**Buen día.** Respecto a su **plan de inversión**:\n\n",
    }
    intro = intros.get(mode, intros["chat"])
    prefix = f"{attribution}\n\n---\n\n" if attribution else ""
    content = prefix + intro + (body[:3600] if body else "—")
    if len(body) > 3600:
        content += "\n\n… *(respuesta recortada por límite de Discord)*"

    e = discord.Embed(description=content, color=colors.get(mode, PERU_RED))
    apply_peru_branding(e, requested_by=requested_by, thumbnail=True)

    if requested_by:
        e.insert_field_at(
            0,
            name="📌 Respuesta dirigida a",
            value=f"**{requested_by.display_name}** · {format_query_timestamp(queried_at)}",
            inline=False,
        )

    if opinion:
        e.add_field(
            name="💬 Opinión del consejero",
            value=opinion[:1020],
            inline=False,
        )
    if strengths:
        e.add_field(
            name="✅ Puntos fuertes del plan",
            value=strengths[:1020],
            inline=False,
        )
    if filename:
        e.add_field(name="📄 Expediente", value=f"`{filename}`", inline=True)
    if usage:
        if usage.get("is_pro"):
            uso_txt = "💎 Pro — sin límite en esta cuenta"
        else:
            lim = usage.get("limit", 10)
            uso_txt = f"**{usage.get('count', 0)}/{lim}** auditorías (esta conversación)"
        e.add_field(name="📊 Cupo", value=uso_txt, inline=True)

    return e


def freemium_blocked_embed(requested_by: Optional[discord.abc.User] = None) -> discord.Embed:
    e = discord.Embed(
        description=(
            "**Buen día.**\n\n"
            "Ha alcanzado el límite de **auditorías gratuitas** en **esta conversación**.\n\n"
            "• **`/reiniciar_memoria`** — inicie un nuevo análisis y recupere su cupo\n"
            "• **`/conectar_wallet`** — **Plan Pro** con historial persistente\n"
            "• Abra otro canal o mensaje directo para una conversación nueva"
        ),
        color=PERU_DARK_RED,
    )
    apply_peru_branding(e, requested_by=requested_by, thumbnail=True)
    return e


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
        label="Reiniciar",
        style=discord.ButtonStyle.secondary,
        emoji="🧠",
        custom_id="cedit:btn_reset",
        row=1,
    )
    async def btn_reset(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            embed=peru_embed(
                "**Buen día.**\n\n"
                "Ejecute **`/reiniciar_memoria`** para borrar el contexto de esta conversación "
                "y recuperar sus **auditorías gratuitas**.",
                requested_by=interaction.user,
            ),
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
