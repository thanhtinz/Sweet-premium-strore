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


@router.get("/google")
def google_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg["google_client_id"]:
        raise HTTPException(501, "Google OAuth chưa được cấu hình")
    redirect_uri = cfg["google_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/google/callback"
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
    redirect_uri = cfg["google_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/google/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": cfg["google_client_id"],
            "client_secret": cfg["google_client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse("/#/login?error=google_failed")
        tokens = token_res.json()
        info_res = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if info_res.status_code != 200:
            return RedirectResponse("/#/login?error=google_failed")
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
    redirect_uri = cfg["discord_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/discord/callback"
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
    redirect_uri = cfg["discord_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/discord/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://discord.com/api/oauth2/token", data={
            "code": code,
            "client_id": cfg["discord_client_id"],
            "client_secret": cfg["discord_client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse("/#/login?error=discord_failed")
        tokens = token_res.json()
        info_res = await client.get("https://discord.com/api/users/@me", headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if info_res.status_code != 200:
            return RedirectResponse("/#/login?error=discord_failed")
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
        return RedirectResponse("/#/login?error=account_disabled")
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
    return RedirectResponse(f"/#/auth-callback?token={token}")
