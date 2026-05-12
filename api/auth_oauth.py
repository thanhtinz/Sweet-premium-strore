import httpx
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from api.bot_links import link_platform_account
from api.auth_shared import _create_token, _get_oauth_config
from db import get_db
from db.models import User

router = APIRouter(tags=["auth"])


def _get_origin(request: Request) -> str:
    """Get the public-facing origin, respecting X-Forwarded-* headers from reverse proxy."""
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}"


@router.get("/debug-origin")
def debug_origin(request: Request):
    """Temporary debug endpoint - remove after fixing"""
    return {
        "base_url": str(request.base_url),
        "origin": _get_origin(request),
        "x_forwarded_proto": request.headers.get("x-forwarded-proto"),
        "x_forwarded_host": request.headers.get("x-forwarded-host"),
        "host": request.headers.get("host"),
        "scheme": request.url.scheme,
        "google_callback": _get_origin(request) + "/api/auth/google/callback",
    }


@router.get("/google")
def google_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg["google_client_id"]:
        raise HTTPException(501, "Google OAuth chưa được cấu hình")
    redirect_uri = cfg["google_redirect_uri"] or _get_origin(request) + "/api/auth/google/callback"
    params = {
        "client_id": cfg["google_client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(code: str, request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    redirect_uri = cfg["google_redirect_uri"] or _get_origin(request) + "/api/auth/google/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": cfg["google_client_id"],
            "client_secret": cfg["google_client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse("/login?error=google_failed")
        tokens = token_res.json()
        info_res = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if info_res.status_code != 200:
            return RedirectResponse("/login?error=google_failed")
        info = info_res.json()

    return _social_login_finish(
        db=db,
        provider="google",
        provider_id=info["id"],
        email=info.get("email", ""),
        display_name=info.get("name", ""),
        avatar_url=info.get("picture", ""),
    )


@router.get("/discord")
def discord_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg["discord_client_id"]:
        raise HTTPException(501, "Discord OAuth chưa được cấu hình")
    redirect_uri = cfg["discord_redirect_uri"] or _get_origin(request) + "/api/auth/discord/callback"
    params = {
        "client_id": cfg["discord_client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "identify email",
        "prompt": "consent",
    }
    return RedirectResponse(f"https://discord.com/api/oauth2/authorize?{urlencode(params)}")


@router.get("/discord/callback")
async def discord_callback(code: str, request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    redirect_uri = cfg["discord_redirect_uri"] or _get_origin(request) + "/api/auth/discord/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://discord.com/api/oauth2/token", data={
            "code": code,
            "client_id": cfg["discord_client_id"],
            "client_secret": cfg["discord_client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse("/login?error=discord_failed")
        tokens = token_res.json()
        info_res = await client.get("https://discord.com/api/users/@me", headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if info_res.status_code != 200:
            return RedirectResponse("/login?error=discord_failed")
        info = info_res.json()

    avatar_url = ""
    if info.get("avatar"):
        avatar_url = f"https://cdn.discordapp.com/avatars/{info['id']}/{info['avatar']}.png"

    return _social_login_finish(
        db=db,
        provider="discord",
        provider_id=info["id"],
        email=info.get("email", ""),
        display_name=info.get("global_name") or info.get("username", ""),
        avatar_url=avatar_url,
    )


# ── Facebook ──────────────────────────────────────────────

@router.get("/facebook")
def facebook_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg.get("facebook_client_id"):
        raise HTTPException(501, "Facebook OAuth chưa được cấu hình")
    redirect_uri = cfg.get("facebook_redirect_uri") or _get_origin(request) + "/api/auth/facebook/callback"
    params = {
        "client_id": cfg["facebook_client_id"],
        "redirect_uri": redirect_uri,
        "scope": "email,public_profile",
        "response_type": "code",
    }
    return RedirectResponse(f"https://www.facebook.com/v19.0/dialog/oauth?{urlencode(params)}")


@router.get("/facebook/callback")
async def facebook_callback(code: str, request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    redirect_uri = cfg.get("facebook_redirect_uri") or _get_origin(request) + "/api/auth/facebook/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.get("https://graph.facebook.com/v19.0/oauth/access_token", params={
            "code": code,
            "client_id": cfg["facebook_client_id"],
            "client_secret": cfg["facebook_client_secret"],
            "redirect_uri": redirect_uri,
        })
        if token_res.status_code != 200:
            return RedirectResponse("/login?error=facebook_failed")
        access_token = token_res.json().get("access_token")
        info_res = await client.get("https://graph.facebook.com/me", params={
            "fields": "id,name,email,picture.type(large)",
            "access_token": access_token,
        })
        if info_res.status_code != 200:
            return RedirectResponse("/login?error=facebook_failed")
        info = info_res.json()

    avatar_url = ""
    pic = info.get("picture", {}).get("data", {})
    if pic.get("url"):
        avatar_url = pic["url"]

    return _social_login_finish(
        db=db,
        provider="facebook",
        provider_id=info["id"],
        email=info.get("email", ""),
        display_name=info.get("name", ""),
        avatar_url=avatar_url,
    )


# ── GitHub ────────────────────────────────────────────────

@router.get("/github")
def github_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg.get("github_client_id"):
        raise HTTPException(501, "GitHub OAuth chưa được cấu hình")
    redirect_uri = cfg.get("github_redirect_uri") or _get_origin(request) + "/api/auth/github/callback"
    params = {
        "client_id": cfg["github_client_id"],
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email",
    }
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{urlencode(params)}")


@router.get("/github/callback")
async def github_callback(code: str, request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    redirect_uri = cfg.get("github_redirect_uri") or _get_origin(request) + "/api/auth/github/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://github.com/login/oauth/access_token", data={
            "code": code,
            "client_id": cfg["github_client_id"],
            "client_secret": cfg["github_client_secret"],
            "redirect_uri": redirect_uri,
        }, headers={"Accept": "application/json"})
        if token_res.status_code != 200:
            return RedirectResponse("/login?error=github_failed")
        access_token = token_res.json().get("access_token")
        if not access_token:
            return RedirectResponse("/login?error=github_failed")
        # Get user info
        info_res = await client.get("https://api.github.com/user", headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
        })
        if info_res.status_code != 200:
            return RedirectResponse("/login?error=github_failed")
        info = info_res.json()
        # Get primary email if not public
        email = info.get("email") or ""
        if not email:
            emails_res = await client.get("https://api.github.com/user/emails", headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            })
            if emails_res.status_code == 200:
                for e in emails_res.json():
                    if e.get("primary") and e.get("verified"):
                        email = e["email"]
                        break

    return _social_login_finish(
        db=db,
        provider="github",
        provider_id=str(info["id"]),
        email=email,
        display_name=info.get("name") or info.get("login", ""),
        avatar_url=info.get("avatar_url", ""),
    )


# ── TikTok ────────────────────────────────────────────────

@router.get("/tiktok")
def tiktok_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg.get("tiktok_client_id"):
        raise HTTPException(501, "TikTok OAuth chưa được cấu hình")
    redirect_uri = cfg.get("tiktok_redirect_uri") or _get_origin(request) + "/api/auth/tiktok/callback"
    import secrets as _secrets
    state = _secrets.token_urlsafe(16)
    params = {
        "client_key": cfg["tiktok_client_id"],
        "redirect_uri": redirect_uri,
        "scope": "user.info.basic",
        "response_type": "code",
        "state": state,
    }
    return RedirectResponse(f"https://www.tiktok.com/v2/auth/authorize/?{urlencode(params)}")


@router.get("/tiktok/callback")
async def tiktok_callback(code: str, request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    redirect_uri = cfg.get("tiktok_redirect_uri") or _get_origin(request) + "/api/auth/tiktok/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://open.tiktokapis.com/v2/oauth/token/", data={
            "client_key": cfg["tiktok_client_id"],
            "client_secret": cfg["tiktok_client_secret"],
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }, headers={"Content-Type": "application/x-www-form-urlencoded"})
        if token_res.status_code != 200:
            return RedirectResponse("/login?error=tiktok_failed")
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        open_id = token_data.get("open_id", "")
        if not access_token:
            return RedirectResponse("/login?error=tiktok_failed")
        info_res = await client.get("https://open.tiktokapis.com/v2/user/info/", params={
            "fields": "open_id,display_name,avatar_url",
        }, headers={
            "Authorization": f"Bearer {access_token}",
        })
        if info_res.status_code != 200:
            return RedirectResponse("/login?error=tiktok_failed")
        data = info_res.json().get("data", {}).get("user", {})

    return _social_login_finish(
        db=db,
        provider="tiktok",
        provider_id=data.get("open_id") or open_id,
        email="",
        display_name=data.get("display_name", ""),
        avatar_url=data.get("avatar_url", ""),
    )


def _social_login_finish(db: Session, provider: str, provider_id: str, email: str, display_name: str, avatar_url: str):
    user = db.query(User).filter(User.provider == provider, User.provider_id == provider_id).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            if not user.provider_id:
                user.provider = provider
                user.provider_id = provider_id
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
            if not user.display_name and display_name:
                user.display_name = display_name
            db.commit()
    if not user:
        user = User(
            email=email or f"{provider}_{provider_id}@social.local",
            display_name=display_name,
            avatar_url=avatar_url,
            provider=provider,
            provider_id=provider_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    if not user.is_active:
        return RedirectResponse("/login?error=account_disabled")
    if provider == "discord":
        link_platform_account(
            db,
            user_id=str(user.id),
            platform="discord",
            platform_user_id=provider_id,
            platform_username=display_name or None,
            metadata={"source": "discord_oauth"},
            verified=True,
        )
    token = _create_token(user)
    return RedirectResponse(f"/auth-callback?token={token}")
