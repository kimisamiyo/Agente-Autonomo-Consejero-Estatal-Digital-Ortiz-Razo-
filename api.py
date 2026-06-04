import io
import logging
import threading
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Request, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from cedit_core import (
    run_chat,
    run_audit_pdf,
    run_refine_plan,
    generate_plan_pdf,
    get_usage,
    reset_usage,
    FreemiumLimitError,
    detect_input_mode,
    consumes_freemium_credit,
    public_llm_error_message,
    reload_groq_config,
    groq_runtime_status,
)
from premium_store import (
    register_wallet,
    connect_wallet,
    lookup_wallet,
    is_pro_wallet,
    activate_wallet,
    record_mint_backup,
    record_pending_pdf_attestation,
    consume_pending_pdf_attestation,
    peek_pending_pdf_attestation,
    record_pdf_firma_backup,
)
from cedit_channel_urls import build_channel_url
from chain_service import (
    build_conversation_text,
    chain_enabled,
    pdf_chain_enabled,
    get_chain_config,
    hash_user_identifier,
    keccak256_pdf_hash,
    mint_registro,
    mint_firma_pdf,
    restore_conversation_for_wallet,
    MEF_APPROVAL_THRESHOLD,
    conversation_content_digest,
    build_registro_attest_message,
    build_pdf_attest_message,
    verify_wallet_signature,
    assert_fresh_attest,
    CEDIT_CONTRACT_ADDRESS,
)
from mef_news_automation import sync_mef_news, get_latest_snapshot, MEF_NEWS_LIST_URL

app = FastAPI(title="API Consejero Estatal Digital")
log = logging.getLogger("cedit.api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    canal: str = "web"
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    locale: Optional[str] = None
    session_mode: Optional[str] = None


class GeneratePDFRequest(BaseModel):
    content: str
    title: str = "Plan de Inversión Pública"
    project_name: str = "Proyecto CEDIT"
    modifications: Optional[str] = None
    history: Optional[List[ChatMessage]] = []
    user_id: Optional[str] = None
    audit_opinion: Optional[str] = None
    audit_dictamen: Optional[str] = None
    source_document: Optional[str] = None
    is_audit: bool = False
    pdf_output_language: str = "es"


class RefinePlanRequest(BaseModel):
    original_content: str
    user_request: str
    history: List[ChatMessage] = []
    user_id: Optional[str] = None


class DetectModeRequest(BaseModel):
    message: str
    has_pdf: bool = False
    session_mode: Optional[str] = None


class MefNewsSyncRequest(BaseModel):
    verify_urls: bool = True
    max_verify: int = 20
    canal: str = "api"
    triggered_at: Optional[str] = None


class PremiumRegisterRequest(BaseModel):
    wallet: str
    display_name: str
    user_id: Optional[str] = None


class PremiumConnectRequest(BaseModel):
    wallet: str


class PremiumActivateRequest(BaseModel):
    wallet: str
    display_name: Optional[str] = None
    user_id: Optional[str] = None


class BlockchainMintRequest(BaseModel):
    wallet: str
    channel: str = "Web"
    history: List[ChatMessage] = []
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    conversation_text: Optional[str] = None
    signature: Optional[str] = None
    issued_at: Optional[int] = None


class BlockchainPdfMintRequest(BaseModel):
    wallet: str
    pdf_hash: str
    channel: str = "Web"
    channel_url: Optional[str] = None
    mef_score: int = 0
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    signature: Optional[str] = None
    issued_at: Optional[int] = None


class BlockchainSyncBackupRequest(BaseModel):
    wallet: str
    token_id: int
    channel: str = "Web"
    kind: str = "registro"
    history: List[ChatMessage] = []
    pdf_hash: Optional[str] = None
    mef_score: Optional[int] = None
    conversation_id: Optional[str] = None


def _uid(header: Optional[str], body_id: Optional[str]) -> str:
    return body_id or header or "web_anonymous"


@app.on_event("startup")
async def _on_startup():
    reload_groq_config()
    st = groq_runtime_status()
    log.info("Groq activo: primary=%s fallback=%s", st["primary"], st["fallback"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "CEDIT", "groq": groq_runtime_status()}


def _scope(
    x_user_id: Optional[str],
    body_id: Optional[str],
    x_conversation_id: Optional[str] = None,
) -> str:
    return x_conversation_id or body_id or _uid(x_user_id, None)


def _pro_usage():
    return {
        "count": 0,
        "limit": "∞",
        "remaining": "∞",
        "freemium_exceeded": False,
        "is_pro": True,
    }


@app.post("/api/premium/register")
async def premium_register(req: PremiumRegisterRequest):
    try:
        entry = register_wallet(req.wallet, req.display_name, req.user_id or "")
        return {"ok": True, "is_pro": True, **entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/premium/connect")
async def premium_connect(req: PremiumConnectRequest):
    try:
        entry = connect_wallet(req.wallet)
        return {"ok": True, "is_pro": True, **entry}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/premium/activate")
async def premium_activate(req: PremiumActivateRequest):
    try:
        entry = activate_wallet(req.wallet, req.display_name, req.user_id or "")
        return {"ok": True, "is_pro": True, **entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/premium/lookup")
async def premium_lookup(wallet: str):
    entry = lookup_wallet(wallet)
    if not entry:
        raise HTTPException(status_code=404, detail="Wallet no registrada")
    return entry


@app.get("/api/blockchain/config")
async def blockchain_config():
    return get_chain_config()


@app.get("/api/blockchain/restore")
async def blockchain_restore(wallet: str = Query(..., min_length=6)):
    data = restore_conversation_for_wallet(wallet)
    if not data:
        raise HTTPException(status_code=404, detail="No hay conversación guardada on-chain para esta wallet.")
    if not is_pro_wallet(wallet):
        try:
            activate_wallet(wallet)
        except ValueError:
            pass
    return {"ok": True, **data}


@app.post("/api/blockchain/prepare-attest-web")
async def blockchain_prepare_attest_web(req: BlockchainMintRequest):
    if not chain_enabled():
        raise HTTPException(status_code=503, detail="CeditRegistros no configurado en el servidor.")
    wallet = (req.wallet or "").strip()
    if not wallet.startswith("0x"):
        raise HTTPException(status_code=400, detail="Wallet inválida")
    if not is_pro_wallet(wallet):
        raise HTTPException(status_code=403, detail="Plan Pro requerido.")
    hist = [{"role": m.role, "content": m.content} for m in req.history]
    text = req.conversation_text or build_conversation_text(hist)
    if not text.strip():
        raise HTTPException(status_code=400, detail="No hay conversación para atestiguar.")
    cfg = get_chain_config()
    channel = req.channel or "Web"
    user_hash = hash_user_identifier(channel, user_id=req.user_id or "", wallet=wallet)
    digest = conversation_content_digest(text)
    contract = cfg.get("contract_address") or CEDIT_CONTRACT_ADDRESS
    issued_at = int(time.time())
    sign_message = build_registro_attest_message(
        wallet, channel, user_hash, digest, contract, issued_at
    )
    return {
        "ok": True,
        "contract_address": contract,
        "chain_id": cfg.get("chain_id"),
        "channel": channel,
        "user_hash": user_hash,
        "conversation_digest": digest,
        "issued_at": issued_at,
        "sign_message": sign_message,
    }


@app.post("/api/blockchain/prepare-attest-pdf-web")
async def blockchain_prepare_attest_pdf_web(req: BlockchainPdfMintRequest):
    if not pdf_chain_enabled():
        raise HTTPException(status_code=503, detail="CeditFirmasPdf no configurado.")
    wallet = (req.wallet or "").strip()
    if not wallet.startswith("0x"):
        raise HTTPException(status_code=400, detail="Wallet inválida")
    if not is_pro_wallet(wallet):
        raise HTTPException(status_code=403, detail="Plan Pro requerido.")
    pending = peek_pending_pdf_attestation(wallet, conversation_id=req.conversation_id or "")
    if not pending:
        raise HTTPException(
            status_code=400,
            detail="Genere el PDF oficial primero (≥80% MEF) en esta conversación.",
        )
    mef = int(pending.get("mef_score") or req.mef_score or 0)
    if mef < MEF_APPROVAL_THRESHOLD:
        raise HTTPException(status_code=400, detail=f"Índice MEF insuficiente ({mef}%).")
    channel_url = (req.channel_url or pending.get("channel_url") or "").strip()
    if not channel_url:
        channel_url = build_channel_url(req.channel or "Web", conversation_id=req.conversation_id or "")
    cfg = get_chain_config()
    channel = req.channel or pending.get("channel") or "Web"
    pdf_hash = pending.get("pdf_hash")
    contract = cfg.get("pdf_contract_address") or ""
    issued_at = int(time.time())
    sign_message = build_pdf_attest_message(
        wallet, pdf_hash, channel, channel_url, mef, contract, issued_at
    )
    return {
        "ok": True,
        "contract_address": contract,
        "chain_id": cfg.get("chain_id"),
        "pdf_hash": pdf_hash,
        "channel_url": channel_url,
        "channel": channel,
        "mef_score": mef,
        "issued_at": issued_at,
        "sign_message": sign_message,
    }


@app.post("/api/blockchain/sync-backup")
async def blockchain_sync_backup(req: BlockchainSyncBackupRequest):
    """Tras mint en wallet (web), indexa token en servidor."""
    wallet = (req.wallet or "").strip()
    if not wallet.startswith("0x"):
        raise HTTPException(status_code=400, detail="Wallet inválida")
    kind = (req.kind or "registro").lower()
    if kind == "pdf_firma":
        record_pdf_firma_backup(
            wallet,
            int(req.token_id),
            pdf_hash=req.pdf_hash or "",
            channel=req.channel or "Web",
            mef_score=int(req.mef_score or 0),
        )
        if req.pdf_hash:
            consume_pending_pdf_attestation(
                wallet, req.pdf_hash, conversation_id=req.conversation_id or ""
            )
    else:
        hist = [{"role": m.role, "content": m.content} for m in req.history]
        record_mint_backup(
            wallet,
            int(req.token_id),
            messages=hist or None,
            channel=req.channel or "Web",
        )
    return {"ok": True, "token_id": int(req.token_id), "kind": kind}


@app.post("/api/blockchain/attest")
@app.post("/api/blockchain/mint")
async def blockchain_mint(req: BlockchainMintRequest):
    if not chain_enabled():
        raise HTTPException(
            status_code=503,
            detail="Mint no disponible: configure CEDIT_CONTRACT_ADDRESS y CEDIT_MINTER_PRIVATE_KEY en .env",
        )
    wallet = (req.wallet or "").strip()
    if not wallet.startswith("0x") or len(wallet) < 10:
        raise HTTPException(status_code=400, detail="Dirección wallet inválida")
    try:
        activate_wallet(wallet, user_id=req.user_id or "")
    except ValueError:
        pass
    hist = [{"role": m.role, "content": m.content} for m in req.history]
    text = req.conversation_text or build_conversation_text(hist)
    channel = req.channel or "Web"
    if channel.lower() == "web":
        if not req.signature or req.issued_at is None:
            raise HTTPException(
                status_code=400,
                detail="Debe firmar la autorización en su extensión (MetaMask/Pali).",
            )
        try:
            assert_fresh_attest(int(req.issued_at))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        user_hash = hash_user_identifier(channel, user_id=req.user_id or "", wallet=wallet)
        digest = conversation_content_digest(text)
        cfg = get_chain_config()
        contract = cfg.get("contract_address") or ""
        expected = build_registro_attest_message(
            wallet, channel, user_hash, digest, contract, int(req.issued_at)
        )
        if not verify_wallet_signature(wallet, expected, req.signature):
            raise HTTPException(status_code=403, detail="Firma inválida o wallet no coincide.")
    try:
        result = mint_registro(
            wallet,
            req.channel or "Web",
            user_id=req.user_id or "",
            wallet=wallet,
            conversation_text=text,
        )
        result["user_hash_preview"] = hash_user_identifier(
            req.channel or "Web", user_id=req.user_id or "", wallet=wallet
        )
        if result.get("token_id") is not None:
            hist = [{"role": m.role, "content": m.content} for m in req.history]
            record_mint_backup(
                wallet,
                int(result["token_id"]),
                messages=hist or None,
                channel=req.channel or "Web",
            )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        log.exception("blockchain mint: %s", e)
        raise HTTPException(status_code=500, detail=f"Error al acuñar NFT: {e}")


@app.post("/api/blockchain/attest-pdf")
async def blockchain_attest_pdf(req: BlockchainPdfMintRequest):
    if not pdf_chain_enabled():
        raise HTTPException(
            status_code=503,
            detail="Firma PDF on-chain no disponible: configure CEDIT_PDF_CONTRACT_ADDRESS en .env",
        )
    wallet = (req.wallet or "").strip()
    if not wallet.startswith("0x") or len(wallet) < 10:
        raise HTTPException(status_code=400, detail="Dirección wallet inválida")
    if int(req.mef_score) < MEF_APPROVAL_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"La firma PDF requiere índice MEF ≥ {MEF_APPROVAL_THRESHOLD}% (recibido: {req.mef_score}%).",
        )
    if not is_pro_wallet(wallet):
        raise HTTPException(status_code=403, detail="Plan Pro requerido para firmar el PDF en blockchain.")
    pending_peek = peek_pending_pdf_attestation(wallet, conversation_id=req.conversation_id or "")
    if not pending_peek:
        raise HTTPException(
            status_code=400,
            detail="Hash PDF no coincide con el último plan generado en esta sesión. Genere el PDF de nuevo.",
        )
    channel = req.channel or pending_peek.get("channel") or "Web"
    channel_url = (req.channel_url or pending_peek.get("channel_url") or "").strip()
    if not channel_url:
        channel_url = build_channel_url(channel, conversation_id=req.conversation_id or "")
    mef = int(pending_peek.get("mef_score") or req.mef_score or 0)
    if channel.lower() == "web":
        if not req.signature or req.issued_at is None:
            raise HTTPException(
                status_code=400,
                detail="Debe firmar la autorización en su extensión (MetaMask/Pali).",
            )
        try:
            assert_fresh_attest(int(req.issued_at))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        cfg = get_chain_config()
        contract = cfg.get("pdf_contract_address") or ""
        expected = build_pdf_attest_message(
            wallet,
            pending_peek["pdf_hash"],
            channel,
            channel_url,
            mef,
            contract,
            int(req.issued_at),
        )
        if not verify_wallet_signature(wallet, expected, req.signature):
            raise HTTPException(status_code=403, detail="Firma inválida o wallet no coincide.")
    pending = consume_pending_pdf_attestation(
        wallet,
        req.pdf_hash or pending_peek["pdf_hash"],
        conversation_id=req.conversation_id or "",
    )
    if not pending:
        raise HTTPException(
            status_code=400,
            detail="Hash PDF no coincide con el último plan generado en esta sesión. Genere el PDF de nuevo.",
        )
    channel_url = (req.channel_url or pending.get("channel_url") or channel_url).strip()
    try:
        activate_wallet(wallet, user_id=req.user_id or "")
    except ValueError:
        pass
    try:
        result = mint_firma_pdf(
            wallet,
            pending["pdf_hash"],
            channel_url,
            req.channel or pending.get("channel") or "Web",
            int(pending.get("mef_score") or req.mef_score),
        )
        if result.get("token_id") is not None:
            record_pdf_firma_backup(
                wallet,
                int(result["token_id"]),
                pdf_hash=result.get("pdf_hash") or pending["pdf_hash"],
                channel=result.get("channel") or "Web",
                mef_score=int(pending.get("mef_score") or req.mef_score),
            )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.exception("blockchain attest-pdf: %s", e)
        raise HTTPException(status_code=500, detail=f"Error al firmar PDF on-chain: {e}")


@app.post("/api/reset-freemium")
async def reset_freemium_endpoint(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
):
    """Reinicia cupo freemium del scope (userId compartido en web gratis)."""
    if is_pro_wallet(x_wallet):
        return {"ok": True, "usage": _pro_usage()}
    scope = x_conversation_id or _uid(x_user_id, None)
    return {"ok": True, "usage": reset_usage(scope)}


@app.get("/api/usage")
async def usage_endpoint(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    scope: Optional[str] = None,
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
):
    if is_pro_wallet(x_wallet):
        return _pro_usage()
    return get_usage(scope or x_conversation_id or _uid(x_user_id, None))


@app.post("/api/automation/mef-news/sync")
async def mef_news_sync_endpoint(
    request: MefNewsSyncRequest = MefNewsSyncRequest(),
    x_automation_key: Optional[str] = Header(None, alias="X-Automation-Key"),
):
    """
    Radar diario de noticias MEF (Gob.pe). Usado por n8n CEDIT-03 a las 08:00.
    Opcional: header X-Automation-Key si defines CEDIT_AUTOMATION_KEY en .env
    """
    import os

    expected = os.environ.get("CEDIT_AUTOMATION_KEY", "").strip()
    if expected and (x_automation_key or "") != expected:
        raise HTTPException(status_code=401, detail="Clave de automatización inválida.")
    try:
        return sync_mef_news(
            verify_urls=request.verify_urls,
            max_verify=min(max(request.max_verify, 1), 40),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_llm_error_message(e))


@app.get("/api/automation/mef-news/latest")
async def mef_news_latest_endpoint():
    """Último estado del radar MEF (para panel o depuración)."""
    return get_latest_snapshot()


@app.get("/api/automation/mef-news/source")
async def mef_news_source_endpoint():
    return {"source_url": MEF_NEWS_LIST_URL}


@app.post("/api/detect-mode")
async def detect_mode_endpoint(req: DetectModeRequest):
    mode = detect_input_mode(req.message, has_pdf=req.has_pdf)
    billable = consumes_freemium_credit(
        req.message, has_pdf=req.has_pdf, mode=mode, session_mode=req.session_mode
    )
    return {"mode": mode, "is_premium_mode": billable, "consumes_audit_credit": billable}


@app.post("/api/chat")
async def chat_endpoint(
    request: ChatRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
    x_locale: Optional[str] = Header("es", alias="X-Locale"),
):
    user_id = _uid(x_user_id, request.user_id)
    scope = _scope(x_user_id, request.conversation_id, x_conversation_id)
    pro = is_pro_wallet(x_wallet)
    history = [{"role": m.role, "content": m.content} for m in request.history]
    try:
        result = run_chat(
            request.message,
            history=history,
            user_id=user_id,
            canal=request.canal,
            usage_scope=scope,
            skip_usage=pro,
            locale=x_locale or request.locale or "es",
            session_mode=request.session_mode,
        )
        if pro:
            result["usage"] = _pro_usage()
        return result
    except FreemiumLimitError as e:
        raise HTTPException(status_code=402, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_llm_error_message(e))


@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    user_text: str = Form(""),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
    canal: str = Form("web"),
    x_locale: Optional[str] = Header("es", alias="X-Locale"),
    locale: str = Form(""),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF.")
    user_id = _uid(x_user_id, None)
    scope = x_conversation_id or user_id
    pro = is_pro_wallet(x_wallet)
    try:
        content = await file.read()
        result = run_audit_pdf(
            content,
            file.filename,
            user_text=user_text,
            user_id=user_id,
            canal=canal,
            usage_scope=scope,
            skip_usage=pro,
            locale=x_locale or (locale.strip() if locale else None) or "es",
        )
        if pro:
            result["usage"] = _pro_usage()
        return result
    except FreemiumLimitError as e:
        raise HTTPException(status_code=402, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_llm_error_message(e))


@app.post("/api/generate-pdf")
async def generate_pdf_endpoint(
    request: GeneratePDFRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
    x_locale: Optional[str] = Header("es", alias="X-Locale"),
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-Id"),
):
    user_id = _uid(x_user_id, request.user_id)
    pro = is_pro_wallet(x_wallet)
    conv_id = x_conversation_id or ""
    history = [{"role": m.role, "content": m.content} for m in (request.history or [])]
    try:
        pdf_bytes, filename, doc_hash, plan_score = generate_plan_pdf(
            request.content,
            title=request.title,
            project_name=request.project_name,
            modifications=request.modifications,
            history=history,
            user_id=user_id,
            skip_usage=pro,
            audit_opinion=request.audit_opinion or "",
            audit_dictamen=request.audit_dictamen or "",
            source_document=request.source_document or "",
            pdf_output_language=request.pdf_output_language or "es",
        )
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        score_hdr = str(plan_score.get("estimated_with_official_plan", 0))
        mef_est = int(plan_score.get("estimated_with_official_plan", 0) or 0)
        meets = bool(plan_score.get("meets_expediente_threshold")) and mef_est >= MEF_APPROVAL_THRESHOLD
        pdf_keccak = keccak256_pdf_hash(pdf_bytes)
        headers = {
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Blockchain-Hash": doc_hash,
            "X-Pdf-Hash-Keccak": pdf_keccak,
            "X-MEF-Score": score_hdr,
            "X-MEF-Meets-Threshold": "1" if meets else "0",
            "X-Pdf-Firma-Available": "1" if (meets and pro and pdf_chain_enabled()) else "0",
            "X-Network": "zkSYS Syscoin Testnet",
        }
        if meets and pro and pdf_chain_enabled() and x_wallet:
            channel_url = build_channel_url("Web", conversation_id=conv_id)
            record_pending_pdf_attestation(
                x_wallet.strip(),
                pdf_hash=pdf_keccak,
                mef_score=mef_est,
                channel_url=channel_url,
                channel="Web",
                conversation_id=conv_id,
            )
        return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
    except FreemiumLimitError as e:
        raise HTTPException(status_code=402, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=public_llm_error_message(e))


@app.post("/api/refine-plan")
async def refine_plan_endpoint(
    request: RefinePlanRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
):
    user_id = _uid(x_user_id, request.user_id)
    pro = is_pro_wallet(x_wallet)
    history = [{"role": m.role, "content": m.content} for m in request.history]
    try:
        result = run_refine_plan(
            request.original_content,
            request.user_request,
            history=history,
            user_id=user_id,
            skip_usage=pro,
        )
        if pro:
            result["usage"] = _pro_usage()
        return result
    except FreemiumLimitError as e:
        raise HTTPException(status_code=402, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_llm_error_message(e))


@app.get("/api/whatsapp/webhook")
async def whatsapp_webhook_verify(
    hub_mode: str = Query("", alias="hub.mode"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
    hub_challenge: str = Query("", alias="hub.challenge"),
):
    """Verificación Meta WhatsApp Cloud API."""
    from whatsapp_client import WHATSAPP_VERIFY_TOKEN, is_configured

    if not is_configured():
        raise HTTPException(status_code=503, detail="WhatsApp no configurado en .env")
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Token de verificación inválido")


@app.post("/api/whatsapp/webhook")
async def whatsapp_webhook_receive(request: Request):
    """Recibe mensajes de Meta y procesa en un hilo (no se cancela con reload)."""
    from whatsapp_client import is_configured
    from whatsapp_handler import handle_webhook_payload, extract_messages

    if not is_configured():
        return {"status": "ignored", "reason": "whatsapp_not_configured"}
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "reason": "invalid_json"}
    msgs = extract_messages(payload)
    if msgs:
        from whatsapp_client import mark_read

        for msg in msgs:
            mid = msg.get("message_id")
            if mid:
                mark_read(mid)
        log.info("WhatsApp webhook: %d mensaje(s) de %s", len(msgs), msgs[0].get("wa_id", "?"))
    else:
        log.debug("WhatsApp webhook sin mensajes entrantes (p. ej. solo status)")
    threading.Thread(target=handle_webhook_payload, args=(payload,), daemon=False).start()
    return {"status": "ok"}


@app.get("/api/whatsapp/status")
async def whatsapp_status():
    from whatsapp_client import is_configured, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION

    return {
        "configured": is_configured(),
        "phone_number_id_set": bool(WHATSAPP_PHONE_NUMBER_ID),
        "api_version": WHATSAPP_API_VERSION,
        "webhook_path": "/api/whatsapp/webhook",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
