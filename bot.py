"""
Bot Discord CEDIT — embeds, botones, freemium por conversación, Plan Pro.
"""
import io
import sys
from datetime import datetime
from pathlib import Path

# Consola Windows: evitar UnicodeEncodeError con emojis
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import discord
from discord import app_commands
from discord.ext import commands
import os
from dotenv import load_dotenv

from cedit_core import (
    run_chat,
    run_audit_pdf,
    run_refine_plan,
    generate_plan_pdf,
    FreemiumLimitError,
    detect_input_mode,
    consumes_freemium_credit,
)
from discord_session import get_session, activate_pro_user, get_pro_settings
from discord_ui import (
    welcome_embed,
    audit_bar_embed,
    guide_graph_embed,
    response_embed,
    freemium_blocked_embed,
    pro_welcome_embed,
    thinking_embed,
    peru_embed,
    document_received_embed,
    MainMenuView,
    PlanActionView,
    ResetMemoryConfirmView,
)

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")
ROOT_DIR = Path(__file__).resolve().parent
AVATAR_FILE = ROOT_DIR / "assets" / "cedit-discord-avatar.png"
PROFILE_MARKER = ROOT_DIR / ".cedit_profile_synced"
BOT_DISPLAY_NAME = os.getenv("DISCORD_BOT_NAME", "CEDIT - Agent")

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


def _is_dm(channel) -> bool:
    return isinstance(channel, discord.DMChannel)


async def _channel_send(target, *, embed=None, view=None, file=None):
    if isinstance(target, discord.Interaction):
        return await target.followup.send(embed=embed, view=view, file=file)
    return await target.send(embed=embed, view=view, file=file)


def _requester(target, requested_by: discord.User | None = None) -> discord.User | None:
    if requested_by:
        return requested_by
    if isinstance(target, discord.Interaction):
        return target.user
    return None


async def send_bot_response(
    target,
    result: dict,
    sess,
    *,
    thinking_msg: discord.Message | None = None,
    requested_by: discord.User | None = None,
    query_preview: str = "",
    queried_at: datetime | None = None,
):
    """Envía embed de respuesta + barra de auditoría + botones."""
    user = _requester(target, requested_by)
    when = queried_at or datetime.now()
    mode = result.get("mode", sess.mode)
    sess.mode = mode
    usage = sess.usage()

    body = result.get("display") or result.get("response", "")
    main = response_embed(
        body,
        mode=mode,
        usage=usage,
        filename=result.get("filename"),
        opinion=result.get("opinion"),
        strengths=result.get("strengths"),
        requested_by=user,
    )

    view = PlanActionView(show_pdf=result.get("show_pdf", False)) if result.get("show_pdf") else None

    if thinking_msg:
        try:
            await thinking_msg.delete()
        except discord.HTTPException:
            pass

    await _channel_send(target, embed=main, view=view)

    if mode in ("audit", "plan"):
        bar = audit_bar_embed(usage, mode, requested_by=user)
        await _channel_send(target, embed=bar, view=MainMenuView())
        if result.get("guide_graph"):
            trail = guide_graph_embed(result["guide_graph"], requested_by=user)
            await _channel_send(target, embed=trail)


async def _apply_discord_profile():
    """Nombre visible + avatar institucional (CEDIT_FORCE_AVATAR=1 para repetir)."""
    if PROFILE_MARKER.exists() and os.getenv("CEDIT_FORCE_AVATAR") != "1":
        return
    kwargs = {"username": BOT_DISPLAY_NAME}
    if AVATAR_FILE.is_file():
        kwargs["avatar"] = AVATAR_FILE.read_bytes()
    try:
        await bot.user.edit(**kwargs)
        PROFILE_MARKER.write_text("ok", encoding="utf-8")
        print(f"[CEDIT] Perfil Discord: '{BOT_DISPLAY_NAME}'")
    except discord.HTTPException as ex:
        print(f"[CEDIT] No se pudo actualizar perfil (limite Discord?): {ex}")


@bot.event
async def on_ready():
    bot.add_view(MainMenuView())
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name="Al servicio del Perú | /ayuda",
        )
    )
    await _apply_discord_profile()
    print(f"[CEDIT] {bot.user} ({bot.user.global_name or bot.user.name}) conectado")
    try:
        synced = await bot.tree.sync()
        print(f"[CEDIT] Slash commands: {len(synced)}")
    except Exception as ex:
        print(f"[CEDIT] Sync warning: {ex}")


@bot.tree.command(name="reiniciar_memoria", description="Borra el contexto de ESTA conversación y recupera auditorías gratis")
async def slash_reiniciar(interaction: discord.Interaction):
    is_dm = _is_dm(interaction.channel)
    key = (interaction.channel_id, interaction.user.id, is_dm)
    await interaction.response.send_message(
        embed=peru_embed(
            "**¿Reiniciar memoria?**\n\n"
            "Su progreso en esta conversación se **perderá**, pero recuperará las "
            "**10 auditorías gratuitas** y podrá seguir usando el agente.",
            requested_by=interaction.user,
            title="🧠 Reiniciar memoria",
        ),
        view=ResetMemoryConfirmView(key),
        ephemeral=True,
    )


@bot.tree.command(name="conectar_wallet", description="Activar Plan Pro (blockchain + memoria persistente)")
@app_commands.describe(
    wallet="Dirección wallet o 'demo' para prueba",
    guardar_memoria="¿Guardar conversaciones en Pro? (si no, modo privado)",
)
async def slash_wallet(
    interaction: discord.Interaction,
    wallet: str,
    guardar_memoria: bool = True,
):
    activate_pro_user(interaction.user.id, wallet=wallet, persist=guardar_memoria)
    await interaction.response.send_message(
        embed=pro_welcome_embed(wallet, guardar_memoria, requested_by=interaction.user),
        ephemeral=True,
    )


@bot.tree.command(name="ayuda", description="Menú principal del Consejero Estatal Digital")
async def slash_ayuda(interaction: discord.Interaction):
    await interaction.response.send_message(
        embed=welcome_embed(interaction.user), view=MainMenuView()
    )


@bot.tree.command(name="uso", description="Barra de auditoría de esta conversación")
async def slash_uso(interaction: discord.Interaction):
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    await interaction.response.send_message(
        embed=audit_bar_embed(sess.usage(), sess.mode, requested_by=interaction.user),
        ephemeral=True,
    )


@bot.tree.command(name="auditar", description="Auditar plan o expediente (texto)")
@app_commands.describe(consulta="Describe tu plan o expediente")
async def slash_auditar(interaction: discord.Interaction, consulta: str):
    queried_at = datetime.now()
    await interaction.response.defer(thinking=True)
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    try:
        sess.check_freemium("audit")
        result = run_chat(
            consulta,
            history=sess.history,
            user_id=f"discord_{interaction.user.id}",
            canal="discord",
            skip_usage=True,
        )
        sess.append("user", consulta)
        sess.append("assistant", result.get("display") or result["response"])
        if result.get("consumes_audit_credit"):
            sess.increment_audit("audit")
        if result.get("show_pdf"):
            sess.set_plan(
                result["response"],
                opinion=result.get("opinion", ""),
                dictamen=result.get("dictamen", ""),
            )
        await send_bot_response(
            interaction, result, sess,
            requested_by=interaction.user,
            query_preview=consulta,
            queried_at=queried_at,
        )
    except FreemiumLimitError:
        await interaction.followup.send(
            embed=freemium_blocked_embed(interaction.user),
            view=ResetMemoryConfirmView((interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))),
        )
    except Exception as e:
        await interaction.followup.send(f"Error: {e}")


@bot.tree.command(name="plan", description="Generar PDF técnico MEF del último análisis")
async def slash_plan(interaction: discord.Interaction):
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    content = sess.get_plan()
    if not content:
        await interaction.response.send_message(
            "Primero audita un plan (PDF o `/auditar`).", ephemeral=True
        )
        return
    await interaction.response.defer(thinking=True)
    try:
        sess.check_freemium("plan")
        meta = sess.get_audit_meta()
        pdf_bytes, filename, doc_hash, _plan_score = generate_plan_pdf(
            content,
            title=f"Plan MEF — {sess.get_filename() or 'CEDIT'}",
            project_name=sess.get_filename().replace(".pdf", "") if sess.get_filename() else "Proyecto CEDIT",
            history=sess.history,
            user_id=f"discord_{interaction.user.id}",
            skip_usage=True,
            audit_opinion=meta.get("opinion", ""),
            audit_dictamen=meta.get("dictamen", ""),
            source_document=meta.get("source_excerpt", ""),
        )
        sess.increment_audit("plan")
        pdf_ok = peru_embed(
            f"**Buen día.**\n\nSu **plan técnico oficial MEF** ha sido generado.\n\n"
            f"🔗 Trazabilidad: `{doc_hash}`",
            requested_by=interaction.user,
        )
        await interaction.followup.send(
            embed=pdf_ok,
            file=discord.File(io.BytesIO(pdf_bytes), filename=filename),
        )
        await interaction.followup.send(
            embed=audit_bar_embed(sess.usage(), "plan", requested_by=interaction.user)
        )
    except FreemiumLimitError:
        await interaction.followup.send(
            embed=freemium_blocked_embed(interaction.user),
            view=ResetMemoryConfirmView((interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))),
        )
    except Exception as e:
        await interaction.followup.send(f"Error: {e}")


@bot.tree.command(name="corregir", description="Corregir el último plan según tus indicaciones")
@app_commands.describe(solicitud="Cambios que necesitas")
async def slash_corregir(interaction: discord.Interaction, solicitud: str):
    queried_at = datetime.now()
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    original = sess.get_plan()
    if not original:
        await interaction.response.send_message("No hay plan previo en esta conversación.", ephemeral=True)
        return
    await interaction.response.defer(thinking=True)
    try:
        sess.check_freemium("plan")
        result = run_refine_plan(
            original,
            solicitud,
            history=sess.history,
            user_id=f"discord_{interaction.user.id}",
            skip_usage=True,
        )
        sess.append("user", f"Corrección: {solicitud}")
        sess.append("assistant", result.get("display") or result["response"])
        sess.set_plan(result["response"])
        sess.increment_audit("plan")
        await send_bot_response(
            interaction, result, sess,
            requested_by=interaction.user,
            query_preview=solicitud,
            queried_at=queried_at,
        )
    except FreemiumLimitError:
        await interaction.followup.send(
            embed=freemium_blocked_embed(interaction.user),
            view=ResetMemoryConfirmView((interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))),
        )
    except Exception as e:
        await interaction.followup.send(f"Error: {e}")


async def process_user_message(message: discord.Message, text: str):
    is_dm = _is_dm(message.channel)
    sess = get_session(message.channel.id, message.author.id, is_dm)

    if text.lower() in ("ayuda", "help", "menu", "inicio"):
        await message.channel.send(
            embed=welcome_embed(message.author), view=MainMenuView()
        )
        return

    pdf_attachments = [a for a in message.attachments if a.filename.lower().endswith(".pdf")]
    if pdf_attachments:
        queried_at = datetime.now()
        thinking = await message.channel.send(
            embed=thinking_embed("Analizando su expediente PDF ante el MEF…")
        )
        try:
            att = pdf_attachments[0]
            data = await att.read()
            mode = "audit"
            sess.check_freemium(mode)
            from cedit_core import get_pdf_document_stats

            try:
                _, pages, chars = get_pdf_document_stats(data)
            except ValueError:
                pages, chars = 0, 0
            recv = document_received_embed(
                att.filename, pages, chars, requested_by=message.author
            )
            try:
                await thinking.delete()
            except discord.HTTPException:
                pass
            await message.channel.send(embed=recv)
            thinking = await message.channel.send(
                embed=thinking_embed("Revisando expediente ante normativa MEF…")
            )
            result = run_audit_pdf(
                data,
                att.filename,
                user_text=text,
                user_id=f"discord_{message.author.id}",
                canal="discord",
                skip_usage=True,
            )
            sess.mode = "audit"
            sess.append("user", f"PDF: {att.filename}" + (f"\n{text}" if text else ""))
            sess.append("assistant", result.get("display") or result["response"])
            if result.get("consumes_audit_credit"):
                sess.increment_audit("audit")
            sess.set_plan(
                result["response"],
                att.filename,
                opinion=result.get("opinion", ""),
                dictamen=result.get("dictamen", ""),
                source_excerpt=result.get("source_excerpt", ""),
            )
            preview = f"PDF: {att.filename}" + (f" — {text}" if text else "")
            await send_bot_response(
                message.channel, result, sess,
                thinking_msg=thinking,
                requested_by=message.author,
                query_preview=preview,
                queried_at=queried_at,
            )
        except FreemiumLimitError:
            try:
                await thinking.delete()
            except Exception:
                pass
            await message.channel.send(
                embed=freemium_blocked_embed(message.author),
                view=ResetMemoryConfirmView((message.channel.id, message.author.id, is_dm)),
            )
        except Exception as e:
            try:
                await thinking.delete()
            except Exception:
                pass
            await message.channel.send(f"Error al auditar: {e}")
        return

    if not text:
        return

    queried_at = datetime.now()
    thinking = await message.channel.send(embed=thinking_embed("Consultando normativa vigente…"))
    try:
        active_mode = sess.mode if sess.mode in ("audit", "plan") else None
        mode = detect_input_mode(text)
        billable = consumes_freemium_credit(
            text, mode=mode, session_mode=active_mode, history=sess.history
        )
        if billable:
            sess.check_freemium("audit")
        result = run_chat(
            text,
            history=sess.history,
            user_id=f"discord_{message.author.id}",
            canal="discord",
            skip_usage=True,
            session_mode=active_mode,
        )
        sess.append("user", text)
        sess.append("assistant", result.get("display") or result["response"])
        if result.get("consumes_audit_credit"):
            bill_mode = result.get("input_mode") or "audit"
            sess.increment_audit(bill_mode)
            sess.mode = bill_mode
        if result.get("show_pdf"):
            sess.set_plan(
                result["response"],
                opinion=result.get("opinion", ""),
                dictamen=result.get("dictamen", ""),
            )
        await send_bot_response(
            message.channel, result, sess,
            thinking_msg=thinking,
            requested_by=message.author,
            query_preview=text,
            queried_at=queried_at,
        )
    except FreemiumLimitError:
        try:
            await thinking.delete()
        except Exception:
            pass
        await message.channel.send(
            embed=freemium_blocked_embed(message.author),
            view=ResetMemoryConfirmView((message.channel.id, message.author.id, is_dm)),
        )
    except Exception as e:
        try:
            await thinking.delete()
        except Exception:
            pass
        await message.channel.send(f"Error: {e}")


@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    bot_mentioned = bot.user in message.mentions
    is_dm = _is_dm(message.channel)
    raw = message.content or ""

    for m in message.mentions:
        raw = raw.replace(f"<@{m.id}>", "").replace(f"<@!{m.id}>", "")
    raw = raw.strip()

    # !consulta — como en el embed de bienvenida
    if raw.startswith("!"):
        query = raw[1:].strip()
        if not query and not message.attachments:
            await message.channel.send(
                embed=welcome_embed(message.author), view=MainMenuView()
            )
            await bot.process_commands(message)
            return
        await process_user_message(message, query)
        await bot.process_commands(message)
        return

    if bot_mentioned or is_dm or message.attachments:
        await process_user_message(message, raw)
        await bot.process_commands(message)
        return

    await bot.process_commands(message)


@bot.command(name="ayuda")
async def cmd_ayuda(ctx):
    await ctx.send(embed=welcome_embed(ctx.author), view=MainMenuView())


@bot.command(name="pregunta")
async def cmd_pregunta(ctx, *, pregunta: str):
    await process_user_message(ctx.message, pregunta)


if TOKEN:
    bot.run(TOKEN)
else:
    print("DISCORD_TOKEN no encontrado en .env")
