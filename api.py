import io
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from cedit_core import (
    run_chat,
    run_audit_pdf,
    run_refine_plan,
    generate_plan_pdf,
    get_usage,
    FreemiumLimitError,
    detect_input_mode,
)
from premium_store import register_wallet, connect_wallet, lookup_wallet, is_pro_wallet

app = FastAPI(title="API Consejero Estatal Digital")

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


class GeneratePDFRequest(BaseModel):
    content: str
    title: str = "Plan de Inversión Pública"
    project_name: str = "Proyecto CEDIT"
    modifications: Optional[str] = None
    history: Optional[List[ChatMessage]] = []
    user_id: Optional[str] = None


class RefinePlanRequest(BaseModel):
    original_content: str
    user_request: str
    history: List[ChatMessage] = []
    user_id: Optional[str] = None


class DetectModeRequest(BaseModel):
    message: str
    has_pdf: bool = False


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


@app.post("/api/detect-mode")
async def detect_mode_endpoint(req: DetectModeRequest):
    mode = detect_input_mode(req.message, has_pdf=req.has_pdf)
    return {"mode": mode, "is_premium_mode": mode in ("audit", "plan")}


@app.post("/api/chat")
async def chat_endpoint(
    request: ChatRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-Id"),
    x_wallet: Optional[str] = Header(None, alias="X-Wallet-Address"),
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
):
    user_id = _uid(x_user_id, request.user_id)
    pro = is_pro_wallet(x_wallet)
    history = [{"role": m.role, "content": m.content} for m in (request.history or [])]
    try:
        pdf_bytes, filename, doc_hash = generate_plan_pdf(
            request.content,
            title=request.title,
            project_name=request.project_name,
            modifications=request.modifications,
            history=history,
            user_id=user_id,
            skip_usage=pro,
        )
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Blockchain-Hash": doc_hash,
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
