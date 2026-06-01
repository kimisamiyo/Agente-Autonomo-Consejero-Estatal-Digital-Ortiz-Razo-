"""
Bot Discord CEDIT — mentor fluido, slash commands, PDF ≥80%, métricas.
"""
import io
import inspect
import sys
import os
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import discord
from discord import app_commands
from discord.ext import commands
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
from discord_mentor import is_mentor_mode, pdf_lock_reason, mentor_chat_body
from discord_session import get_session, activate_pro_user, get_pro_settings
from discord_ui import (
    welcome_embed,
    audit_bar_embed,
    guide_graph_embed,
    response_embed,
    freemium_blocked_embed,
    pro_welcome_embed,
    peru_embed,
    mentor_opinion_embed,
    mentor_panel_embed,
    metrics_embed,
    MainMenuView,
    MentorActionView,
    ResetMemoryConfirmView,
)

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")
ROOT_DIR = Path(__file__).resolve().parent
AVATAR_FILE = ROOT_DIR / "assets" / "cedit-discord-avatar.png"
PROFILE_MARKER = ROOT_DIR / ".cedit_profile_synced"
BOT_DISPLAY_NAME = os.getenv("DISCORD_BOT_NAME", "CEDIT - Agent")
MSG_LOCK_DIR = ROOT_DIR / ".discord_msg_locks"
_inflight_messages: set[int] = set()

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


def _is_dm(channel) -> bool:
    return isinstance(channel, discord.DMChannel)


def _conv_key(channel_id: int, user_id: int, is_dm: bool) -> tuple:
    return (channel_id, user_id, is_dm)


def _claim_message(message_id: int) -> bool:
    """Evita procesar el mismo mensaje dos veces (reintentos o dos instancias del bot)."""
    if message_id in _inflight_messages:
        return False
    _inflight_messages.add(message_id)
    MSG_LOCK_DIR.mkdir(exist_ok=True)
    lock_path = MSG_LOCK_DIR / f"{message_id}.lock"
    try:
        fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
        return True
    except FileExistsError:
        _inflight_messages.discard(message_id)
        return False


def _release_message(message_id: int) -> None:
    _inflight_messages.discard(message_id)
    lock_path = MSG_LOCK_DIR / f"{message_id}.lock"
    try:
        lock_path.unlink(missing_ok=True)
    except OSError:
        pass


async def _post_response(
    target,
    *,
    embed=None,
    view=None,
    file=None,
    reply_to: discord.Message | None = None,
):
    """Exactamente un mensaje de salida."""
    if reply_to is not None:
        return await reply_to.reply(embed=embed, view=view, file=file, mention_author=False)
    if isinstance(target, discord.Interaction):
        return await target.followup.send(embed=embed, view=view, file=file)
    return await target.send(embed=embed, view=view, file=file)


def _requester(target, requested_by: discord.User | None = None) -> discord.User | None:
    if requested_by:
        return requested_by
    if isinstance(target, discord.Interaction):
        return target.user
    return None


def _notify_session_events(sess) -> str:
    """Texto para anteponer al único mensaje de respuesta (p. ej. aviso 24 h)."""
    if sess.auto_reset_notice:
        sess.auto_reset_notice = False
        return (
            "⏱️ Pasaron **24 horas** sin actividad (plan gratuito). "
            "Reinicié su memoria — cuénteme de nuevo su proyecto.\n\n"
        )
    return ""


async def _as_text(value) -> str:
    """Evita pasar coroutines sin await a embeds (.strip())."""
    if inspect.iscoroutine(value):
        value = await value
    if value is None:
        return ""
    return value if isinstance(value, str) else str(value)


def _assistant_history_content(result: dict) -> str:
    """Guarda en historial solo la parte conversacional (sin duplicar panel/checklist)."""
    mode = result.get("input_mode") or result.get("mode", "chat")
    if is_mentor_mode(result.get("mode", ""), mode):
        body = mentor_chat_body(result)
        if body and body != "—":
            return body
    return result.get("display") or result.get("response", "")


def _apply_result_to_session(sess, result: dict, user_text: str = "") -> None:
    mode = result.get("input_mode") or result.get("mode", "chat")
    if result.get("consumes_audit_credit"):
        sess.increment_audit(mode if mode in ("audit", "plan") else "audit")
        sess.mode = mode if mode in ("audit", "plan") else sess.mode
    elif is_mentor_mode(result.get("mode", ""), mode):
        sess.mode = mode

    if is_mentor_mode(result.get("mode", ""), mode):
        sess.set_mentor_result(result)
        if result.get("response") or result.get("opinion"):
            sess.set_plan(
                result.get("response", ""),
                opinion=result.get("opinion", ""),
                dictamen=result.get("dictamen", ""),
            )


async def send_bot_response(
    target,
    result: dict,
    sess,
    *,
    requested_by: discord.User | None = None,
    query_preview: str = "",
    queried_at: datetime | None = None,
    channel_id: int = 0,
    is_dm: bool = False,
    lead_note: str = "",
    pdf_filename: str = "",
    pdf_pages: int = 0,
    reply_to: discord.Message | None = None,
):
    lead_note = await _as_text(lead_note)
    user = _requester(target, requested_by)
    mode = result.get("input_mode") or result.get("mode", sess.mode)
    usage = sess.usage()
    mentor = is_mentor_mode(result.get("mode", ""), mode)

    key = _conv_key(channel_id or getattr(getattr(target, "channel", None), "id", 0), user.id if user else 0, is_dm)
    action_view = MentorActionView(
        key,
        show_pdf=bool(result.get("show_pdf")),
        has_plan=bool(sess.get_plan()),
    )

    if mentor and (result.get("opinion") or result.get("guide_graph") or result.get("response")):
        main = mentor_opinion_embed(
            result,
            requested_by=user,
            lead_note=lead_note,
            pdf_filename=pdf_filename or result.get("filename", ""),
            pdf_pages=pdf_pages,
        )
        await _post_response(
            target, embed=main, view=action_view, reply_to=reply_to,
        )
        return

    body = result.get("display") or result.get("response", "")
    if lead_note:
        body = f"{lead_note.strip()}\n\n{body}"
    main = response_embed(
        body,
        mode=result.get("mode", "chat"),
        usage=usage,
        filename=result.get("filename") or pdf_filename or None,
        opinion=result.get("opinion"),
        strengths=result.get("strengths"),
        requested_by=user,
    )
    await _post_response(
        target,
        embed=main,
        view=MainMenuView() if not mentor else action_view,
        reply_to=reply_to,
    )


async def _apply_discord_profile():
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
    print(f"[CEDIT] {bot.user} conectado")
    try:
        synced = await bot.tree.sync()
        print(f"[CEDIT] Slash commands: {len(synced)}")
    except Exception as ex:
        print(f"[CEDIT] Sync warning: {ex}")


@bot.tree.command(name="reiniciar_memoria", description="Borra el contexto de ESTA conversación y recupera auditorías gratis")
async def slash_reiniciar(interaction: discord.Interaction):
    is_dm = _is_dm(interaction.channel)
    key = _conv_key(interaction.channel_id, interaction.user.id, is_dm)
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


@bot.tree.command(name="ciudadano", description="Orientación para ciudadanos — derechos y trámites")
async def slash_ciudadano(interaction: discord.Interaction):
    await interaction.response.send_message(
        embed=peru_embed(
            "**Modo ciudadano(a)**\n\n"
            "Escriba por ejemplo:\n"
            "`! ¿Qué derechos tengo ante el silencio administrativo?`\n\n"
            "Le explico trámites y normativa del Estado en palabras sencillas.",
            requested_by=interaction.user,
        ),
        ephemeral=True,
    )


@bot.tree.command(name="servidor", description="Orientación para servidores públicos — MEF e Invierte.pe")
async def slash_servidor(interaction: discord.Interaction):
    await interaction.response.send_message(
        embed=peru_embed(
            "**Modo servidor(a) público(a)**\n\n"
            "Adjunte un **PDF** o escriba:\n"
            "`! Necesito auditar mi plan para Invierte.pe y el MEF`\n\n"
            "También puede usar **`/auditar`** con su consulta.",
            requested_by=interaction.user,
        ),
        ephemeral=True,
    )


@bot.tree.command(name="uso", description="Barra de auditoría de esta conversación")
async def slash_uso(interaction: discord.Interaction):
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    await interaction.response.send_message(
        embed=audit_bar_embed(sess.usage(), sess.mode, requested_by=interaction.user),
        ephemeral=True,
    )


@bot.tree.command(name="metricas", description="Fase del mentor, índice MEF, riesgo y avance del plan")
async def slash_metricas(interaction: discord.Interaction):
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    mentor = sess.get_mentor_result()
    if not mentor:
        await interaction.response.send_message(
            embed=peru_embed(
                "Aún no hay métricas. Escriba **`!`** + su idea o adjunte un **PDF** "
                "y el mentor irá mostrando fase, índice y riesgo.",
                requested_by=interaction.user,
                title="📊 Mis métricas",
            ),
            ephemeral=True,
        )
        return
    await interaction.response.send_message(
        embed=metrics_embed(mentor, sess.usage(), requested_by=interaction.user),
        ephemeral=True,
    )


@bot.tree.command(name="expediente", description="Ver avance del expediente y checklist del mentor")
async def slash_expediente(interaction: discord.Interaction):
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    mentor = sess.get_mentor_result()
    if not mentor:
        await interaction.response.send_message(
            embed=peru_embed("Sin expediente aún. Cuente su proyecto al mentor.", requested_by=interaction.user),
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


@bot.tree.command(name="auditar", description="Guiar o auditar plan / expediente (texto)")
@app_commands.describe(consulta="Describe tu plan, idea o expediente")
async def slash_auditar(interaction: discord.Interaction, consulta: str):
    await interaction.response.defer(thinking=True)
    is_dm = _is_dm(interaction.channel)
    sess = get_session(interaction.channel_id, interaction.user.id, is_dm)
    lead_note = await _as_text(_notify_session_events(sess))
    try:
        sess.check_freemium("audit")
        active = sess.mode if sess.mode in ("audit", "plan") else None
        result = run_chat(
            consulta,
            history=sess.history,
            user_id=f"discord_{interaction.user.id}",
            canal="discord",
            skip_usage=True,
            session_mode=active,
        )
        sess.append("user", consulta)
        sess.append("assistant", _assistant_history_content(result))
        _apply_result_to_session(sess, result)
        await send_bot_response(
            interaction, result, sess,
            requested_by=interaction.user,
            query_preview=consulta,
            channel_id=interaction.channel_id,
            is_dm=is_dm,
            lead_note=lead_note,
        )
    except FreemiumLimitError:
        await interaction.followup.send(
            embed=freemium_blocked_embed(interaction.user),
            view=ResetMemoryConfirmView(_conv_key(interaction.channel_id, interaction.user.id, is_dm)),
        )
    except Exception as e:
        await interaction.followup.send(f"Error: {e}")


@bot.tree.command(name="plan", description="Generar PDF técnico MEF (solo si métricas ≥80%)")
async def slash_plan(interaction: discord.Interaction):
    is_dm = _is_dm(interaction.channel)
    sess = get_session(interaction.channel_id, interaction.user.id, is_dm)
    mentor = sess.get_mentor_result()
    if mentor and not mentor.get("show_pdf"):
        reason = pdf_lock_reason(mentor)
        await interaction.response.send_message(
            embed=peru_embed(f"🔒 **PDF no disponible aún**\n\n{reason}", requested_by=interaction.user),
            ephemeral=True,
        )
        return
    content = sess.get_plan()
    if not content:
        await interaction.response.send_message(
            "Primero guíe su plan con el mentor (`!` + texto o `/auditar`).", ephemeral=True
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
        await interaction.followup.send(
            embed=peru_embed(
                f"**Plan técnico oficial MEF** generado.\n\n🔗 `{doc_hash}`",
                requested_by=interaction.user,
            ),
            file=discord.File(io.BytesIO(pdf_bytes), filename=filename),
        )
        await interaction.followup.send(
            embed=audit_bar_embed(sess.usage(), "plan", requested_by=interaction.user)
        )
    except FreemiumLimitError:
        await interaction.followup.send(
            embed=freemium_blocked_embed(interaction.user),
            view=ResetMemoryConfirmView(_conv_key(interaction.channel_id, interaction.user.id, is_dm)),
        )
    except Exception as e:
        await interaction.followup.send(f"Error: {e}")


@bot.tree.command(name="corregir", description="Corregir el último plan según tus indicaciones")
@app_commands.describe(solicitud="Cambios que necesitas")
async def slash_corregir(interaction: discord.Interaction, solicitud: str):
    sess = get_session(interaction.channel_id, interaction.user.id, _is_dm(interaction.channel))
    original = sess.get_plan()
    if not original:
        await interaction.response.send_message("No hay plan previo en esta conversación.", ephemeral=True)
        return
    await interaction.response.defer(thinking=True)
    is_dm = _is_dm(interaction.channel)
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
        sess.append("assistant", _assistant_history_content(result))
        _apply_result_to_session(sess, result)
        sess.set_plan(result["response"])
        if not result.get("consumes_audit_credit"):
            sess.increment_audit("plan")
        await send_bot_response(
            interaction, result, sess,
            requested_by=interaction.user,
            query_preview=solicitud,
            channel_id=interaction.channel_id,
            is_dm=is_dm,
        )
    except FreemiumLimitError:
        await interaction.followup.send(
            embed=freemium_blocked_embed(interaction.user),
            view=ResetMemoryConfirmView(_conv_key(interaction.channel_id, interaction.user.id, is_dm)),
        )
    except Exception as e:
        await interaction.followup.send(f"Error: {e}")


async def process_user_message(message: discord.Message, text: str):
    if not _claim_message(message.id):
        return
    try:
        is_dm = _is_dm(message.channel)
        sess = get_session(message.channel.id, message.author.id, is_dm)
        lead_note = await _as_text(_notify_session_events(sess))

        if text.lower() in ("ayuda", "help", "menu", "inicio", "metricas", "métricas"):
            if text.lower() in ("metricas", "métricas"):
                mentor = sess.get_mentor_result()
                if mentor:
                    await message.reply(
                        embed=metrics_embed(mentor, sess.usage(), requested_by=message.author),
                        mention_author=False,
                    )
                else:
                    await message.reply(
                        embed=peru_embed("Aún no hay métricas. Cuente su idea al mentor.", requested_by=message.author),
                        mention_author=False,
                    )
                return
            await message.reply(embed=welcome_embed(message.author), view=MainMenuView(), mention_author=False)
            return

        pdf_attachments = [a for a in message.attachments if a.filename.lower().endswith(".pdf")]
        if pdf_attachments:
            try:
                att = pdf_attachments[0]
                data = await att.read()
                sess.check_freemium("audit")
                from cedit_core import get_pdf_document_stats

                try:
                    _, pages, _chars = get_pdf_document_stats(data)
                except ValueError:
                    pages = 0
                async with message.channel.typing():
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
                sess.append("assistant", _assistant_history_content(result))
                _apply_result_to_session(sess, result)
                sess.set_plan(
                    result["response"],
                    att.filename,
                    opinion=result.get("opinion", ""),
                    dictamen=result.get("dictamen", ""),
                    source_excerpt=result.get("source_excerpt", ""),
                )
                await send_bot_response(
                    message.channel, result, sess,
                    requested_by=message.author,
                    channel_id=message.channel.id,
                    is_dm=is_dm,
                    lead_note=lead_note,
                    pdf_filename=att.filename,
                    pdf_pages=pages,
                    reply_to=message,
                )
            except FreemiumLimitError:
                await message.reply(
                    embed=freemium_blocked_embed(message.author),
                    view=ResetMemoryConfirmView(_conv_key(message.channel.id, message.author.id, is_dm)),
                    mention_author=False,
                )
            except Exception as e:
                await message.reply(f"Error al auditar: {e}", mention_author=False)
            return

        if not text:
            return

        async with message.channel.typing():
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
        sess.append("assistant", _assistant_history_content(result))
        _apply_result_to_session(sess, result)
        await send_bot_response(
            message.channel, result, sess,
            requested_by=message.author,
            query_preview=text,
            channel_id=message.channel.id,
            is_dm=is_dm,
            lead_note=lead_note,
            reply_to=message,
        )
    except FreemiumLimitError:
        await message.reply(
            embed=freemium_blocked_embed(message.author),
            view=ResetMemoryConfirmView(_conv_key(message.channel.id, message.author.id, _is_dm(message.channel))),
            mention_author=False,
        )
    except Exception as e:
        await message.reply(f"Error: {e}", mention_author=False)
    finally:
        _release_message(message.id)


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

    if raw.startswith("!"):
        query = raw[1:].strip()
        if not query and not message.attachments:
            await message.reply(embed=welcome_embed(message.author), view=MainMenuView(), mention_author=False)
            return
        await process_user_message(message, query)
        return

    if bot_mentioned or is_dm or message.attachments:
        await process_user_message(message, raw)
        return


if TOKEN:
    bot.run(TOKEN)
else:
    print("DISCORD_TOKEN no encontrado en .env")
