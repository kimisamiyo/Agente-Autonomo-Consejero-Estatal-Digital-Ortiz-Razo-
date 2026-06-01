import io
import logging
import threading
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

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
)
from premium_store import register_wallet, connect_wallet, lookup_wallet, is_pro_wallet
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


def _uid(header: Optional[str], body_id: Optional[str]) -> str:
    return body_id or header or "web_anonymous"


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "CEDIT"}


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


@app.get("/api/premium/lookup")
async def premium_lookup(wallet: str):
    entry = lookup_wallet(wallet)
    if not entry:
        raise HTTPException(status_code=404, detail="Wallet no registrada")
    return entry


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-pdf")
async def generate_pdf_endpoint(
    request: GeneratePDFRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
    x_locale: Optional[str] = Header("es", alias="X-Locale"),
):
    user_id = _uid(x_user_id, request.user_id)
    pro = is_pro_wallet(x_wallet)
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
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Blockchain-Hash": doc_hash,
                "X-MEF-Score": score_hdr,
                "X-MEF-Meets-Threshold": "1" if plan_score.get("meets_expediente_threshold") else "0",
                "X-Network": "zkSYS Syscoin Testnet",
            },
        )
    except FreemiumLimitError as e:
        raise HTTPException(status_code=402, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al generar PDF: {str(e)}")


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
        raise HTTPException(status_code=500, detail=str(e))


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
        log.info("WhatsApp webhook: %d mensaje(s) de %s", len(msgs), msgs[0].get("wa_id", "?"))
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
