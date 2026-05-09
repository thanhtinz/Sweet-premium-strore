"""AI content generation for admin panel.

All providers use OpenAI-compatible /chat/completions format.
Config stored in SiteConfig key 'ai_config' as JSON.
"""

import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_current_admin
from db import get_db
from db.repositories import SiteConfigRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/ai", tags=["admin-ai"])

AI_CONFIG_KEY = "ai_config"

# ── Provider Registry ─────────────────────────────────
PROVIDERS = {
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "models": [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "gemma2-9b-it",
            "mixtral-8x7b-32768",
        ],
        "default_model": "llama-3.3-70b-versatile",
    },
    "mimo": {
        "name": "Xiaomi MiMo",
        "base_url": "https://api.xiaomimimo.com/v1",
        "models": [
            "MiMo-V2.5-Pro",
            "MiMo-V2.5",
            "mimo-v2-pro",
            "mimo-v2-flash",
        ],
        "default_model": "mimo-v2-flash",
    },
    "gemini": {
        "name": "Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "models": [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash",
        ],
        "default_model": "gemini-2.0-flash",
    },
    "glm": {
        "name": "GLM (Zhipu)",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "models": [
            "glm-5.1",
            "glm-4.7",
            "glm-4-flash",
            "glm-4-flashx",
        ],
        "default_model": "glm-4-flash",
    },
    "kimi": {
        "name": "Kimi (Moonshot)",
        "base_url": "https://api.moonshot.cn/v1",
        "models": [
            "kimi-k2.6",
            "kimi-k2.5",
            "moonshot-v1-8k",
            "moonshot-v1-32k",
        ],
        "default_model": "kimi-k2.6",
    },
    "deepseek": {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "models": [
            "deepseek-chat",
            "deepseek-reasoner",
        ],
        "default_model": "deepseek-chat",
    },
}


# ── Helpers ────────────────────────────────────────────

def _mask_key(key: str) -> str:
    if not key or len(key) <= 8:
        return "••••••••" if key else ""
    return key[:4] + "••••" + key[-4:]


def _get_ai_config(db: Session) -> dict:
    repo = SiteConfigRepository(db)
    cfg = repo.get_json(AI_CONFIG_KEY, {})
    return cfg if isinstance(cfg, dict) else {}


def _get_ai_config_safe(db: Session) -> dict:
    """Return config with masked API key for frontend."""
    cfg = _get_ai_config(db)
    safe = dict(cfg)
    if safe.get("api_key"):
        safe["api_key_masked"] = _mask_key(safe["api_key"])
    safe.pop("api_key", None)
    return safe


async def _call_provider(cfg: dict, messages: list[dict], max_tokens: int = 2048) -> str:
    """Call OpenAI-compatible /chat/completions endpoint."""
    provider_id = cfg.get("provider", "")
    provider = PROVIDERS.get(provider_id)
    if not provider:
        raise HTTPException(400, f"Provider không hợp lệ: {provider_id}")

    api_key = cfg.get("api_key", "")
    if not api_key:
        raise HTTPException(400, "Chưa cấu hình API key")

    base_url = cfg.get("custom_base_url") or provider["base_url"]
    model = cfg.get("model") or provider["default_model"]

    url = f"{base_url.rstrip('/')}/chat/completions"

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except httpx.HTTPStatusError as e:
            detail = ""
            try:
                detail = e.response.json().get("error", {}).get("message", e.response.text[:300])
            except Exception:
                detail = e.response.text[:300]
            logger.warning("AI provider error %s: %s", e.response.status_code, detail)
            raise HTTPException(502, f"Lỗi từ {provider['name']}: {detail}")
        except httpx.RequestError as e:
            logger.warning("AI provider request error: %s", str(e))
            raise HTTPException(502, f"Không thể kết nối đến {provider['name']}: {str(e)}")


# ── System Prompts ─────────────────────────────────────

FIELD_PROMPTS = {
    "title": "Viết tiêu đề ngắn gọn, hấp dẫn, tối đa 80 ký tự. Chỉ trả về tiêu đề, không giải thích.",
    "name": "Viết tên ngắn gọn, tối đa 60 ký tự. Chỉ trả về tên, không giải thích.",
    "description": "Viết mô tả chi tiết, hấp dẫn, 2-4 câu. Chỉ trả về mô tả.",
    "short_description": "Viết mô tả ngắn gọn trong 1-2 câu. Chỉ trả về mô tả.",
    "seo_title": "Viết SEO title tối ưu, 50-60 ký tự, chứa keyword chính. Chỉ trả về title.",
    "seo_description": "Viết meta description tối ưu SEO, 120-155 ký tự. Chỉ trả về description.",
    "seo_keywords": "Liệt kê 5-8 keywords phân cách bằng dấu phẩy, tối ưu SEO. Chỉ trả về keywords.",
    "blog_content": "Viết nội dung bài blog chi tiết, có heading, list, format HTML đẹp. Trả về HTML.",
    "blog_excerpt": "Viết tóm tắt bài viết trong 2-3 câu hấp dẫn. Chỉ trả về tóm tắt.",
    "support_content": "Viết nội dung trang hỗ trợ chuyên nghiệp, dùng HTML với heading và list rõ ràng.",
    "email_content": "Viết nội dung email chuyên nghiệp, thân thiện.",
    "announcement": "Viết thông báo ngắn gọn, rõ ràng, chuyên nghiệp.",
    "general": "Viết nội dung phù hợp với ngữ cảnh. Trả về text thuần, không giải thích thêm.",
}

SYSTEM_BASE = (
    "Bạn là trợ lý AI chuyên viết nội dung cho website bán hàng số (game key, tài khoản, phần mềm). "
    "Viết bằng tiếng Việt trừ khi được yêu cầu khác. "
    "Trả về nội dung trực tiếp, KHÔNG bao gồm lời giải thích hay ghi chú."
)


def _build_messages(field_type: str, context: str, prompt: str) -> list[dict]:
    ft_hint = FIELD_PROMPTS.get(field_type, FIELD_PROMPTS["general"])
    system = f"{SYSTEM_BASE}\n\n{ft_hint}"

    user_parts = []
    if context:
        user_parts.append(f"Ngữ cảnh:\n{context}")
    if prompt:
        user_parts.append(f"Yêu cầu: {prompt}")
    if not user_parts:
        user_parts.append("Hãy viết nội dung phù hợp.")

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n\n".join(user_parts)},
    ]


# ── Request/Response Models ────────────────────────────

class AiConfigUpdate(BaseModel):
    provider: str
    api_key: str | None = None
    model: str | None = None
    custom_base_url: str | None = None


class AiGenerateRequest(BaseModel):
    prompt: str = ""
    context: str = ""
    field_type: str = "general"
    max_tokens: int = 2048


# ── Routes ─────────────────────────────────────────────

@router.get("/providers", dependencies=[Depends(get_current_admin)])
def list_providers():
    """Return provider registry (no secrets)."""
    return {
        pid: {"name": p["name"], "models": p["models"], "default_model": p["default_model"]}
        for pid, p in PROVIDERS.items()
    }


@router.get("/config", dependencies=[Depends(get_current_admin)])
def get_ai_config(db: Session = Depends(get_db)):
    """Return current AI config (API key masked)."""
    cfg = _get_ai_config_safe(db)
    cfg["providers"] = {
        pid: {"name": p["name"], "models": p["models"], "default_model": p["default_model"]}
        for pid, p in PROVIDERS.items()
    }
    return cfg


@router.put("/config", dependencies=[Depends(get_current_admin)])
def update_ai_config(data: AiConfigUpdate, db: Session = Depends(get_db)):
    """Save AI provider config."""
    if data.provider not in PROVIDERS:
        raise HTTPException(400, f"Provider không hợp lệ: {data.provider}")

    existing = _get_ai_config(db)
    new_cfg = {
        "provider": data.provider,
        "model": data.model or PROVIDERS[data.provider]["default_model"],
        "custom_base_url": data.custom_base_url or "",
    }

    # Keep existing key if not provided (frontend sends null when unchanged)
    if data.api_key:
        new_cfg["api_key"] = data.api_key
    elif existing.get("api_key"):
        new_cfg["api_key"] = existing["api_key"]

    repo = SiteConfigRepository(db)
    repo.set_json(AI_CONFIG_KEY, new_cfg)
    db.commit()

    safe = dict(new_cfg)
    safe["api_key_masked"] = _mask_key(safe.get("api_key", ""))
    safe.pop("api_key", None)
    return {"ok": True, **safe}


@router.post("/test", dependencies=[Depends(get_current_admin)])
async def test_ai_connection(db: Session = Depends(get_db)):
    """Test current AI config with a simple prompt."""
    cfg = _get_ai_config(db)
    if not cfg.get("provider") or not cfg.get("api_key"):
        raise HTTPException(400, "Chưa cấu hình AI provider hoặc API key")

    messages = [
        {"role": "system", "content": "Trả lời ngắn gọn."},
        {"role": "user", "content": "Xin chào, hãy trả lời 'OK' nếu bạn hoạt động."},
    ]
    result = await _call_provider(cfg, messages, max_tokens=50)
    return {"ok": True, "response": result}


@router.post("/generate", dependencies=[Depends(get_current_admin)])
async def generate_content(req: AiGenerateRequest, db: Session = Depends(get_db)):
    """Generate content for a field."""
    cfg = _get_ai_config(db)
    if not cfg.get("provider") or not cfg.get("api_key"):
        raise HTTPException(400, "Chưa cấu hình AI. Vào Cài đặt → AI để thiết lập.")

    messages = _build_messages(req.field_type, req.context, req.prompt)
    result = await _call_provider(cfg, messages, max_tokens=req.max_tokens)
    return {"ok": True, "content": result}
