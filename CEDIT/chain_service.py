"""
Mint de registros CEDIT en zkTanenbaum Testnet — contrato CeditRegistros (onlyOwner).
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

log = logging.getLogger("cedit.chain")

SYSCOIN_RPC_URL = os.getenv("SYSCOIN_RPC_URL", "https://rpc-zk.tanenbaum.io/")
SYSCOIN_CHAIN_ID = int(os.getenv("SYSCOIN_CHAIN_ID", "57057"))
CEDIT_CONTRACT_ADDRESS = os.getenv("CEDIT_CONTRACT_ADDRESS", "").strip()
CEDIT_PDF_CONTRACT_ADDRESS = os.getenv("CEDIT_PDF_CONTRACT_ADDRESS", "").strip()
CEDIT_MINTER_PRIVATE_KEY = os.getenv("CEDIT_MINTER_PRIVATE_KEY", "").strip()
BLOCK_EXPLORER = os.getenv("SYSCOIN_EXPLORER_URL", "https://explorer-zk.tanenbaum.io/")
MEF_APPROVAL_THRESHOLD = 80

MAX_CONVERSATION_CHARS = 6000

# zkTanenbaum: precio agresivo (gwei) + límite según estimate (conversación larga ~21M gas)
MINT_GAS_GWEI = float(os.getenv("CEDIT_MINT_GAS_GWEI", "100"))
MINT_GAS_LIMIT_MAX = int(os.getenv("CEDIT_MINT_GAS_LIMIT_MAX", "90000000"))
MINT_GAS_BUFFER = float(os.getenv("CEDIT_MINT_GAS_BUFFER", "1.25"))
MINT_GAS_FALLBACK = int(os.getenv("CEDIT_MINT_GAS_FALLBACK", "8000000"))

MINT_ABI = [
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "registros",
        "outputs": [
            {"name": "channel", "type": "string"},
            {"name": "userHash", "type": "string"},
            {"name": "conversationText", "type": "string"},
            {"name": "timestamp", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "recipient", "type": "address"},
            {"name": "channel", "type": "string"},
            {"name": "userHash", "type": "string"},
            {"name": "conversationText", "type": "string"},
        ],
        "name": "mintRegistro",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "tokenId", "type": "uint256"},
            {"indexed": True, "name": "recipient", "type": "address"},
            {"indexed": False, "name": "channel", "type": "string"},
            {"indexed": False, "name": "userHash", "type": "string"},
        ],
        "name": "RegistroAcunado",
        "type": "event",
    },
]

PDF_MINT_ABI = [
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "recipient", "type": "address"},
            {"name": "pdfHash", "type": "bytes32"},
            {"name": "channelUrl", "type": "string"},
            {"name": "channel", "type": "string"},
            {"name": "mefScore", "type": "uint16"},
        ],
        "name": "mintFirmaPdf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "tokenId", "type": "uint256"},
            {"indexed": True, "name": "recipient", "type": "address"},
            {"indexed": True, "name": "pdfHash", "type": "bytes32"},
            {"indexed": False, "name": "channel", "type": "string"},
            {"indexed": False, "name": "channelUrl", "type": "string"},
            {"indexed": False, "name": "mefScore", "type": "uint16"},
        ],
        "name": "FirmaPdfAcunada",
        "type": "event",
    },
]

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s\-]{8,}\d")


def chain_enabled() -> bool:
    return bool(CEDIT_CONTRACT_ADDRESS and CEDIT_MINTER_PRIVATE_KEY)


def pdf_chain_enabled() -> bool:
    return bool(CEDIT_PDF_CONTRACT_ADDRESS and CEDIT_MINTER_PRIVATE_KEY)


def keccak256_pdf_hash(pdf_bytes: bytes) -> str:
    from web3 import Web3

    digest = Web3.keccak(pdf_bytes)
    hex_val = digest.hex() if hasattr(digest, "hex") else str(digest)
    if not hex_val.startswith("0x"):
        hex_val = "0x" + hex_val
    return hex_val.lower()


def parse_pdf_hash_bytes32(pdf_hash: str) -> bytes:
    from web3 import Web3

    h = (pdf_hash or "").strip().lower()
    if h.startswith("0x"):
        h = h[2:]
    if len(h) != 64:
        raise ValueError("Hash PDF inválido: se espera Keccak-256 de 32 bytes (64 hex).")
    return Web3.to_bytes(hexstr=h)


def get_chain_config() -> Dict[str, Any]:
    addr = CEDIT_CONTRACT_ADDRESS or None
    pdf_addr = CEDIT_PDF_CONTRACT_ADDRESS or None
    explorer = BLOCK_EXPLORER.rstrip("/")
    owner_wallet = None
    if CEDIT_MINTER_PRIVATE_KEY:
        try:
            from web3 import Web3
            from eth_account import Account

            w3 = Web3(Web3.HTTPProvider(SYSCOIN_RPC_URL))
            if addr:
                c = w3.eth.contract(address=Web3.to_checksum_address(addr), abi=MINT_ABI)
                owner_wallet = c.functions.owner().call()
            elif pdf_addr:
                c = w3.eth.contract(address=Web3.to_checksum_address(pdf_addr), abi=PDF_MINT_ABI)
                owner_wallet = c.functions.owner().call()
        except Exception:
            owner_wallet = None
    return {
        "enabled": chain_enabled(),
        "pdf_enabled": pdf_chain_enabled(),
        "chain_id": SYSCOIN_CHAIN_ID,
        "chain_name": "zkTanenbaum Testnet",
        "rpc_url": SYSCOIN_RPC_URL,
        "block_explorer": explorer,
        "contract_address": addr,
        "contract_name": "CeditRegistros",
        "contract_explorer_url": f"{explorer}/address/{addr}" if addr else None,
        "pdf_contract_address": pdf_addr,
        "pdf_contract_name": "CeditFirmasPdf",
        "pdf_contract_explorer_url": f"{explorer}/address/{pdf_addr}" if pdf_addr else None,
        "mef_threshold": MEF_APPROVAL_THRESHOLD,
        "web_self_mint": os.getenv("CEDIT_WEB_SELF_MINT", "0").strip() in ("1", "true", "yes"),
        "owner_wallet": owner_wallet,
        "owner_explorer_url": f"{explorer}/address/{owner_wallet}" if owner_wallet else None,
    }


def hash_user_identifier(channel: str, user_id: str = "", wallet: str = "") -> str:
    key = (wallet or user_id or "anon").strip().lower()
    raw = f"cedit:{channel}:{key}".encode("utf-8")
    return "0x" + hashlib.sha256(raw).hexdigest()


def conversation_content_digest(text: str) -> str:
    from web3 import Web3

    digest = Web3.keccak((text or "").encode("utf-8"))
    hex_val = digest.hex() if hasattr(digest, "hex") else str(digest)
    return hex_val if hex_val.startswith("0x") else f"0x{hex_val}"


def build_registro_attest_message(
    wallet: str,
    channel: str,
    user_hash: str,
    conversation_digest: str,
    contract_address: str,
    issued_at: int,
) -> str:
    return (
        "CEDIT — Autorización de mint NFT (CeditRegistros)\n"
        f"Contrato: {contract_address}\n"
        f"Red: zkTanenbaum (chainId {SYSCOIN_CHAIN_ID})\n"
        f"Acción: mint_registro\n"
        f"Wallet: {wallet.strip().lower()}\n"
        f"Canal: {channel}\n"
        f"User hash: {user_hash}\n"
        f"Digest conversación (Keccak-256): {conversation_digest}\n"
        f"Emitido (unix): {issued_at}\n"
        "Al firmar autoriza a CEDIT a acuñar el NFT en su wallet."
    )


def build_pdf_attest_message(
    wallet: str,
    pdf_hash: str,
    channel: str,
    channel_url: str,
    mef_score: int,
    contract_address: str,
    issued_at: int,
) -> str:
    return (
        "CEDIT — Autorización de mint NFT (CeditFirmasPdf)\n"
        f"Contrato: {contract_address}\n"
        f"Red: zkTanenbaum (chainId {SYSCOIN_CHAIN_ID})\n"
        f"Acción: mint_firma_pdf\n"
        f"Wallet: {wallet.strip().lower()}\n"
        f"Canal: {channel}\n"
        f"URL canal: {channel_url}\n"
        f"Hash PDF (Keccak-256): {pdf_hash.strip().lower()}\n"
        f"Índice MEF: {int(mef_score)}%\n"
        f"Emitido (unix): {issued_at}\n"
        "Al firmar autoriza a CEDIT a acuñar la firma PDF en su wallet."
    )


def verify_wallet_signature(wallet: str, message: str, signature: str) -> bool:
    from eth_account import Account
    from eth_account.messages import encode_defunct

    if not signature or not message:
        return False
    try:
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
        return recovered.lower() == wallet.strip().lower()
    except Exception as ex:
        log.warning("verify_wallet_signature: %s", ex)
        return False


def assert_fresh_attest(issued_at: int, *, max_age_sec: int = 600) -> None:
    if issued_at is None:
        raise ValueError("Falta issued_at en la autorización.")
    now = int(time.time())
    if abs(now - int(issued_at)) > max_age_sec:
        raise ValueError("La autorización firmada expiró. Vuelva a intentar el mint.")


def _sanitize_line(text: str) -> str:
    t = EMAIL_RE.sub("[email]", text or "")
    t = PHONE_RE.sub("[telefono]", t)
    return t.strip()


def build_conversation_text(
    history: List[Dict[str, Any]],
    *,
    extra: str = "",
) -> str:
    lines: List[str] = []
    for item in history or []:
        role = (item.get("role") or "user").lower()
        label = "Usuario" if role == "user" else "CEDIT"
        content = _sanitize_line(str(item.get("content") or ""))
        if content:
            lines.append(f"{label}: {content}")
    if extra:
        lines.append(_sanitize_line(extra))
    text = "\n".join(lines).strip()
    if len(text) > MAX_CONVERSATION_CHARS:
        text = text[: MAX_CONVERSATION_CHARS - 40] + "\n\n… [recortado para on-chain]"
    return text or "Sin contenido de conversación."


def _web3_base():
    from web3 import Web3
    from eth_account import Account

    if not CEDIT_MINTER_PRIVATE_KEY:
        raise RuntimeError("Blockchain no configurada: falta CEDIT_MINTER_PRIVATE_KEY en .env")
    w3 = Web3(Web3.HTTPProvider(SYSCOIN_RPC_URL))
    if not w3.is_connected():
        raise RuntimeError(f"No se pudo conectar al RPC: {SYSCOIN_RPC_URL}")
    account = Account.from_key(CEDIT_MINTER_PRIVATE_KEY)
    return w3, account


def _web3_client():
    if not chain_enabled():
        raise RuntimeError(
            "Blockchain no configurada. Defina CEDIT_CONTRACT_ADDRESS y CEDIT_MINTER_PRIVATE_KEY en .env"
        )
    from web3 import Web3

    w3, account = _web3_base()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(CEDIT_CONTRACT_ADDRESS),
        abi=MINT_ABI,
    )
    return w3, account, contract


def _web3_pdf_client():
    if not pdf_chain_enabled():
        raise RuntimeError(
            "Contrato PDF no configurado. Defina CEDIT_PDF_CONTRACT_ADDRESS y CEDIT_MINTER_PRIVATE_KEY en .env"
        )
    from web3 import Web3

    w3, account = _web3_base()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(CEDIT_PDF_CONTRACT_ADDRESS),
        abi=PDF_MINT_ABI,
    )
    return w3, account, contract


def _apply_mint_gas(w3, tx: Dict[str, Any], from_address: str) -> Dict[str, Any]:
    """Gas limit con margen (evita OOG en URI on-chain) + precio alto en zkTanenbaum."""
    # build_transaction puede fijar gas=3.5M; simular con ese tope devuelve 100% y no sube el límite.
    for key in ("gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas"):
        tx.pop(key, None)
    call_tx = {**tx, "from": from_address}
    try:
        estimated = w3.eth.estimate_gas(call_tx)
        gas_limit = int(estimated * MINT_GAS_BUFFER)
        log.info("mint estimate_gas=%s -> limit=%s", estimated, gas_limit)
    except Exception as ex:
        log.warning("estimate_gas mint falló, usando fallback %s: %s", MINT_GAS_FALLBACK, ex)
        gas_limit = MINT_GAS_FALLBACK

    gas_limit = min(max(gas_limit, 500_000), MINT_GAS_LIMIT_MAX)
    tx["gas"] = gas_limit

    target_wei = int(w3.to_wei(MINT_GAS_GWEI, "gwei"))
    try:
        network_wei = int(w3.eth.gas_price)
        target_wei = max(target_wei, int(network_wei * 1.2))
    except Exception:
        pass
    tx["gasPrice"] = target_wei
    log.info("mint gasPrice=%s gwei, gas limit=%s", w3.from_wei(target_wei, "gwei"), gas_limit)
    return tx


def mint_registro(
    recipient: str,
    channel: str,
    *,
    user_id: str = "",
    wallet: str = "",
    history: Optional[List[Dict[str, Any]]] = None,
    conversation_text: Optional[str] = None,
) -> Dict[str, Any]:
    w3, account, contract = _web3_client()
    recipient = w3.to_checksum_address(recipient)
    user_hash = hash_user_identifier(channel, user_id=user_id, wallet=wallet or recipient)
    conv = conversation_text or build_conversation_text(history or [])

    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.functions.mintRegistro(
        recipient,
        channel,
        user_hash,
        conv,
    ).build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "chainId": SYSCOIN_CHAIN_ID,
        }
    )
    tx = _apply_mint_gas(w3, tx, account.address)

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

    if receipt.get("status") != 1:
        raise RuntimeError("La red zkTanenbaum se encuentra saturada. Intente nuevamente mas tarde.")

    token_id = None
    try:
        logs = contract.events.RegistroAcunado().process_receipt(receipt)
        if logs:
            token_id = int(logs[0]["args"]["tokenId"])
    except Exception as ex:
        log.warning("No se pudo leer tokenId del evento: %s", ex)

    tx_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
    if not tx_hex.startswith("0x"):
        tx_hex = "0x" + tx_hex

    return {
        "ok": True,
        "token_id": int(token_id) if token_id is not None else None,
        "conversation_text": conv,
        "tx_hash": tx_hex,
        "user_hash": user_hash,
        "channel": channel,
        "explorer_tx": f"{BLOCK_EXPLORER.rstrip('/')}/tx/{tx_hex}",
        "explorer_nft": (
            f"{BLOCK_EXPLORER.rstrip('/')}/token/{CEDIT_CONTRACT_ADDRESS}?a={token_id}"
            if token_id is not None
            else None
        ),
        "contract_address": CEDIT_CONTRACT_ADDRESS,
        "recipient": recipient,
    }


def mint_firma_pdf(
    recipient: str,
    pdf_hash: str,
    channel_url: str,
    channel: str,
    mef_score: int,
) -> Dict[str, Any]:
    if int(mef_score) < MEF_APPROVAL_THRESHOLD:
        raise ValueError(f"Índice MEF {mef_score}% inferior al umbral {MEF_APPROVAL_THRESHOLD}%")

    w3, account, contract = _web3_pdf_client()
    recipient = w3.to_checksum_address(recipient)
    pdf_bytes32 = parse_pdf_hash_bytes32(pdf_hash)
    channel_url = (channel_url or "").strip()
    if not channel_url:
        raise ValueError("URL del canal requerida para la firma PDF on-chain.")

    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.functions.mintFirmaPdf(
        recipient,
        pdf_bytes32,
        channel_url,
        channel or "Web",
        int(mef_score),
    ).build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "chainId": SYSCOIN_CHAIN_ID,
        }
    )
    tx = _apply_mint_gas(w3, tx, account.address)

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

    if receipt.get("status") != 1:
        raise RuntimeError("La red zkTanenbaum se encuentra saturada. Intente nuevamente mas tarde.")

    token_id = None
    try:
        logs = contract.events.FirmaPdfAcunada().process_receipt(receipt)
        if logs:
            token_id = int(logs[0]["args"]["tokenId"])
    except Exception as ex:
        log.warning("No se pudo leer tokenId FirmaPdfAcunada: %s", ex)

    tx_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
    if not tx_hex.startswith("0x"):
        tx_hex = "0x" + tx_hex

    return {
        "ok": True,
        "kind": "pdf_firma",
        "token_id": int(token_id) if token_id is not None else None,
        "pdf_hash": pdf_hash.lower() if pdf_hash.startswith("0x") else f"0x{pdf_hash}",
        "tx_hash": tx_hex,
        "channel": channel,
        "channel_url": channel_url,
        "mef_score": int(mef_score),
        "explorer_tx": f"{BLOCK_EXPLORER.rstrip('/')}/tx/{tx_hex}",
        "explorer_nft": (
            f"{BLOCK_EXPLORER.rstrip('/')}/token/{CEDIT_PDF_CONTRACT_ADDRESS}?a={token_id}"
            if token_id is not None
            else None
        ),
        "contract_address": CEDIT_PDF_CONTRACT_ADDRESS,
        "recipient": recipient,
    }


def fetch_registro(token_id: int) -> Dict[str, Any]:
    w3, _, contract = _web3_client()
    row = contract.functions.registros(int(token_id)).call()
    return {
        "token_id": int(token_id),
        "channel": row[0],
        "user_hash": row[1],
        "conversation_text": row[2],
        "timestamp": int(row[3]),
    }


def list_token_ids_for_wallet(wallet: str) -> List[int]:
    w3, _, contract = _web3_client()
    addr = w3.to_checksum_address(wallet)
    ids: List[int] = []
    try:
        logs = contract.events.RegistroAcunado().get_logs(fromBlock=0, toBlock="latest")
        for entry in logs:
            args = entry.get("args") or {}
            recipient = args.get("recipient")
            if recipient and str(recipient).lower() == addr.lower():
                ids.append(int(args["tokenId"]))
    except Exception as ex:
        log.warning("get_logs RegistroAcunado: %s", ex)
    return sorted(set(ids))


def parse_conversation_to_messages(text: str) -> List[Dict[str, Any]]:
    messages: List[Dict[str, Any]] = []
    for raw_line in (text or "").split("\n"):
        line = raw_line.strip()
        if not line or line.startswith("…"):
            continue
        if line.startswith("Usuario:"):
            messages.append({"role": "user", "content": line[8:].strip()})
        elif line.startswith("CEDIT:"):
            messages.append({"role": "bot", "content": line[6:].strip(), "mode": "chat"})
    return messages


def restore_conversation_for_wallet(wallet: str) -> Optional[Dict[str, Any]]:
    from premium_store import get_latest_mint_backup

    backup = get_latest_mint_backup(wallet)
    if backup and backup.get("messages"):
        return {
            "token_id": backup.get("token_id"),
            "channel": backup.get("channel", "Web"),
            "messages": backup["messages"],
            "source": "backup",
        }
    if not chain_enabled():
        return None
    token_ids = list_token_ids_for_wallet(wallet)
    if not token_ids:
        return None
    token_id = max(token_ids)
    try:
        reg = fetch_registro(token_id)
    except Exception as ex:
        log.warning("fetch_registro %s: %s", token_id, ex)
        return None
    messages = parse_conversation_to_messages(reg.get("conversation_text") or "")
    if not messages:
        return None
    return {
        "token_id": token_id,
        "channel": reg.get("channel", "Web"),
        "messages": messages,
        "user_hash": reg.get("user_hash"),
        "source": "chain",
    }
