"""
Automatización CEDIT — revisión diaria de noticias MEF en Gob.pe.
Fuente: https://www.gob.pe/institucion/mef/noticias
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from html import unescape
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

import requests

MEF_NEWS_LIST_URL = "https://www.gob.pe/institucion/mef/noticias"
GOBPE_BASE = "https://www.gob.pe"
USER_AGENT = "CEDIT-MEF-NewsBot/1.0 (+automation; Peru public investment advisor)"
STATE_FILENAME = ".cedit_mef_news_state.json"

# Palabras clave para marcar relevancia CEDIT (inversión pública / gestión)
RELEVANCE_KEYWORDS = (
    "inversión",
    "inversion",
    "invierte",
    "mef",
    "municipal",
    "presupuesto",
    "obra",
    "expediente",
    "snip",
    "viabilidad",
    "brecha",
    "fiscal",
    "pbi",
    "gobierno local",
    "emergencia",
    "financiamiento",
)


def _state_path() -> str:
    return os.path.join(os.path.dirname(__file__), STATE_FILENAME)


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load_state() -> Dict[str, Any]:
    path = _state_path()
    if not os.path.exists(path):
        return {
            "last_sync_at": None,
            "last_run_status": None,
            "known_ids": {},
            "items": [],
        }
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state: Dict[str, Any]) -> None:
    path = _state_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def _extract_news_id(path: str) -> Optional[str]:
    m = re.search(r"/noticias/(\d+)-", path)
    return m.group(1) if m else None


def parse_listing_html(html: str) -> List[Dict[str, str]]:
    """Extrae noticias del listado Gob.pe (títulos en h3 > a)."""
    seen: set[str] = set()
    items: List[Dict[str, str]] = []

    for path, raw_title in re.findall(
        r'<h3[^>]*>\s*<a[^>]+href="(/institucion/mef/noticias/[^"]+)"[^>]*>([^<]+)</a>',
        html,
        re.I,
    ):
        news_id = _extract_news_id(path)
        if not news_id or news_id in seen:
            continue
        seen.add(news_id)
        title = unescape(re.sub(r"\s+", " ", raw_title).strip())
        url = urljoin(GOBPE_BASE, path)
        items.append(
            {
                "id": news_id,
                "path": path,
                "url": url,
                "title": title,
                "slug": path.split(f"{news_id}-", 1)[-1] if f"{news_id}-" in path else "",
            }
        )

    if not items:
        for path in re.findall(r'href="(/institucion/mef/noticias/\d+-[^"]+)"', html):
            news_id = _extract_news_id(path)
            if not news_id or news_id in seen:
                continue
            seen.add(news_id)
            slug = path.split(f"{news_id}-", 1)[-1].replace("-", " ").title()
            items.append(
                {
                    "id": news_id,
                    "path": path,
                    "url": urljoin(GOBPE_BASE, path),
                    "title": slug,
                    "slug": path.split(f"{news_id}-", 1)[-1],
                }
            )

    return items


def fetch_listing(timeout: int = 45) -> Tuple[str, List[Dict[str, str]]]:
    resp = requests.get(
        MEF_NEWS_LIST_URL,
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "es-PE,es;q=0.9"},
    )
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"
    items = parse_listing_html(resp.text)
    return resp.text[:500], items


def check_link_ok(url: str, timeout: int = 12) -> bool:
    try:
        r = requests.head(
            url,
            timeout=timeout,
            allow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        )
        if r.status_code >= 400:
            r = requests.get(url, timeout=timeout, stream=True, headers={"User-Agent": USER_AGENT})
            return r.status_code < 400
        return True
    except requests.RequestException:
        return False


def score_relevance(title: str) -> Tuple[int, List[str]]:
    t = (title or "").lower()
    hits = [kw for kw in RELEVANCE_KEYWORDS if kw in t]
    return len(hits), hits


def review_item(item: Dict[str, str], *, verify_url: bool = True) -> Dict[str, Any]:
    score, tags = score_relevance(item.get("title", ""))
    url = item["url"]
    link_ok = check_link_ok(url) if verify_url else True
    return {
        **item,
        "link_ok": link_ok,
        "relevance_score": score,
        "relevance_tags": tags,
        "cedit_relevant": score > 0 or "mef" in (item.get("title") or "").lower(),
        "reviewed_at": _now_iso(),
    }


def sync_mef_news(
    *,
    verify_urls: bool = True,
    max_verify: int = 15,
) -> Dict[str, Any]:
    """
    Sincroniza el listado Gob.pe, detecta noticias nuevas y revisa enlaces.
    Pensado para n8n (cron 8:00) o POST manual a la API.
    """
    state = load_state()
    known: Dict[str, Any] = dict(state.get("known_ids") or {})

    try:
        _, raw_items = fetch_listing()
    except requests.RequestException as exc:
        out = {
            "ok": False,
            "error": str(exc),
            "source_url": MEF_NEWS_LIST_URL,
            "synced_at": _now_iso(),
            "new_count": 0,
            "new_items": [],
        }
        state["last_run_status"] = "error"
        state["last_sync_at"] = out["synced_at"]
        save_state(state)
        return out

    new_items: List[Dict[str, Any]] = []
    verified = 0

    for item in raw_items:
        nid = item["id"]
        if nid in known:
            continue
        do_verify = verify_urls and verified < max_verify
        reviewed = review_item(item, verify_url=do_verify)
        if do_verify:
            verified += 1
        new_items.append(reviewed)
        known[nid] = {
            "url": reviewed["url"],
            "title": reviewed["title"],
            "first_seen_at": reviewed["reviewed_at"],
            "cedit_relevant": reviewed["cedit_relevant"],
        }

    synced_at = _now_iso()
    recent = sorted(
        [
            {
                "id": k,
                **v,
            }
            for k, v in known.items()
        ],
        key=lambda x: x.get("first_seen_at") or "",
        reverse=True,
    )[:40]

    state["known_ids"] = known
    state["items"] = recent
    state["last_sync_at"] = synced_at
    state["last_run_status"] = "ok"
    state["last_new_count"] = len(new_items)
    save_state(state)

    relevant_new = [i for i in new_items if i.get("cedit_relevant")]

    return {
        "ok": True,
        "source_url": MEF_NEWS_LIST_URL,
        "synced_at": synced_at,
        "listing_count": len(raw_items),
        "known_total": len(known),
        "new_count": len(new_items),
        "new_relevant_count": len(relevant_new),
        "new_items": new_items,
        "new_relevant_items": relevant_new,
        "digest_markdown": format_digest_markdown(new_items, synced_at),
    }


def format_digest_markdown(new_items: List[Dict[str, Any]], synced_at: str) -> str:
    if not new_items:
        return (
            f"**CEDIT — Radar MEF** ({synced_at})\n\n"
            f"Sin noticias nuevas en [{MEF_NEWS_LIST_URL}]({MEF_NEWS_LIST_URL})."
        )
    lines = [
        f"**CEDIT — Nuevas noticias MEF** ({synced_at})",
        f"Fuente: [Gob.pe MEF Noticias]({MEF_NEWS_LIST_URL})",
        "",
    ]
    for i, it in enumerate(new_items[:12], 1):
        flag = "✅" if it.get("link_ok", True) else "⚠️"
        rel = "📌" if it.get("cedit_relevant") else "📰"
        tags = ", ".join(it.get("relevance_tags") or []) or "general"
        lines.append(f"{i}. {rel}{flag} [{it['title']}]({it['url']}) — *{tags}*")
    if len(new_items) > 12:
        lines.append(f"\n… y {len(new_items) - 12} más.")
    return "\n".join(lines)


def get_latest_snapshot(limit: int = 20) -> Dict[str, Any]:
    state = load_state()
    return {
        "last_sync_at": state.get("last_sync_at"),
        "last_run_status": state.get("last_run_status"),
        "last_new_count": state.get("last_new_count", 0),
        "known_total": len(state.get("known_ids") or {}),
        "source_url": MEF_NEWS_LIST_URL,
        "items": (state.get("items") or [])[:limit],
    }
