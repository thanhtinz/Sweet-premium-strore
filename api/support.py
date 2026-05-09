"""
Support System APIs: Tickets, Support Pages, Site Config
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from db import SessionLocal
from db.models import (
    SupportTicket, TicketMessage, SupportPage, SiteConfig, Order, User, AdminUser
)
from api.auth import get_current_user, get_current_admin, get_current_staff_or_admin
from api.sanitize import sanitize_html, sanitize_text
import json

router = APIRouter(prefix="/support", tags=["support"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _is_admin(user_id: str, db: Session) -> bool:
    admin = db.query(AdminUser).filter(AdminUser.user_id == str(user_id)).first()
    return admin is not None and admin.role in ("admin", "staff", "superadmin")

# ─── SITE CONFIG ──────────────────────────────────────

@router.get("/config")
async def get_site_config(db: Session = Depends(get_db)):
    """Get all site config (contact info, hours, etc)"""
    configs = db.query(SiteConfig).all()
    result = {}
    for cfg in configs:
        try:
            result[cfg.key] = json.loads(cfg.value) if cfg.value.startswith('{') else cfg.value
        except:
            result[cfg.key] = cfg.value
    return result

@router.put("/config/{key}", dependencies=[Depends(get_current_admin)])
async def update_config(key: str, value: dict, db: Session = Depends(get_db)):
    """Admin: Update site config"""
    cfg = db.query(SiteConfig).filter_by(key=key).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    
    cfg.value = json.dumps(value) if isinstance(value, dict) else str(value)
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "key": key, "value": cfg.value}

# ─── SUPPORT PAGES ────────────────────────────────────

@router.get("/pages")
async def list_support_pages(page_type: str = None, db: Session = Depends(get_db)):
    """Get all published support pages, optionally filtered by type"""
    query = db.query(SupportPage).filter_by(is_published=True)
    if page_type:
        query = query.filter_by(page_type=page_type)
    pages = query.order_by(SupportPage.sort_order).all()
    return pages

@router.get("/pages/{slug}")
async def get_support_page(slug: str, db: Session = Depends(get_db)):
    """Get a specific support page by slug"""
    page = db.query(SupportPage).filter_by(slug=slug, is_published=True).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page

@router.post("/pages", dependencies=[Depends(get_current_admin)])
async def create_support_page(data: dict, db: Session = Depends(get_db)):
    """Admin: Create support page"""
    page = SupportPage(
        slug=data.get("slug"),
        title=sanitize_text(data.get("title", "")),
        content=sanitize_html(data.get("content", "")),
        page_type=data.get("page_type"),
        meta_description=sanitize_text(data.get("meta_description", "")),
        is_published=data.get("is_published", True),
        sort_order=data.get("sort_order", 0),
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    return page

@router.put("/pages/{page_id}", dependencies=[Depends(get_current_admin)])
async def update_support_page(page_id: int, data: dict, db: Session = Depends(get_db)):
    """Admin: Update support page"""
    page = db.query(SupportPage).filter_by(id=page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    for key in ["title", "content", "page_type", "meta_description", "is_published", "sort_order"]:
        if key in data:
            val = data[key]
            if key == "content":
                val = sanitize_html(val)
            elif key in ("title", "meta_description"):
                val = sanitize_text(val)
            setattr(page, key, val)
    
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return page

@router.delete("/pages/{page_id}", dependencies=[Depends(get_current_admin)])
@router.post("/pages/{page_id}/delete", dependencies=[Depends(get_current_admin)])
async def delete_support_page(page_id: int, db: Session = Depends(get_db)):
    """Admin: Delete support page"""
    page = db.query(SupportPage).filter_by(id=page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    db.delete(page)
    db.commit()
    return {"success": True}

# ─── SUPPORT TICKETS ──────────────────────────────────

def generate_ticket_number():
    """Generate unique ticket number"""
    import random
    import string
    return "TK" + datetime.now().strftime("%Y%m%d") + "".join(random.choices(string.digits, k=6))

@router.post("/tickets")
async def create_ticket(data: dict, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create new support ticket (authenticated users only)"""
    ticket_num = generate_ticket_number()
    uid = current_user["user_id"]
    
    ticket = SupportTicket(
        ticket_number=ticket_num,
        user_id=uid,
        user_email=current_user.get("email", data.get("email", "")),
        user_name=data.get("name", ""),
        subject=data.get("subject", ""),
        description=data.get("description", ""),
        category=data.get("category", "other"),
        priority=data.get("priority", "normal"),
        order_id=data.get("order_id"),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {
        "ticket_id": ticket.id,
        "ticket_number": ticket_num,
        "message": "Ticket created successfully"
    }

@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get ticket details — users see own tickets only"""
    ticket = db.query(SupportTicket).filter_by(id=ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    uid = current_user["user_id"]
    is_admin = _is_admin(uid, db)
    if not is_admin and str(ticket.user_id) != str(uid):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = db.query(TicketMessage).filter_by(ticket_id=ticket_id)
    if not is_admin:
        messages = messages.filter_by(is_internal=False)
    
    return {
        "ticket": ticket,
        "messages": messages.all()
    }

@router.get("/tickets")
async def list_tickets(status: str = Query(None), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """List tickets — users see own, admins see all"""
    query = db.query(SupportTicket)
    
    is_admin = _is_admin(current_user["user_id"], db)
    if not is_admin:
        query = query.filter_by(user_id=current_user["user_id"])
    
    if status:
        query = query.filter_by(status=status)
    
    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    return tickets

@router.post("/tickets/{ticket_id}/messages")
async def add_ticket_message(
    ticket_id: int,
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add message to ticket — user must own ticket or be admin"""
    ticket = db.query(SupportTicket).filter_by(id=ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    uid = current_user["user_id"]
    is_admin = _is_admin(uid, db)
    if not is_admin and str(ticket.user_id) != str(uid):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    sender_type = "admin" if is_admin else "user"
    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=uid,
        sender_name=data.get("sender_name", ""),
        sender_type=sender_type,
        message=data.get("message", ""),
        is_internal=data.get("is_internal", False) if is_admin else False,
    )
    db.add(message)
    
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)
    return message

@router.put("/tickets/{ticket_id}/status", dependencies=[Depends(get_current_staff_or_admin)])
async def update_ticket_status(ticket_id: int, status: str, db: Session = Depends(get_db)):
    """Admin: Update ticket status"""
    ticket = db.query(SupportTicket).filter_by(id=ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.status = status
    if status == "resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
    
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "status": status}

@router.put("/tickets/{ticket_id}/assign", dependencies=[Depends(get_current_staff_or_admin)])
async def assign_ticket(ticket_id: int, admin_id: str, db: Session = Depends(get_db)):
    """Admin: Assign ticket to admin"""
    ticket = db.query(SupportTicket).filter_by(id=ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.assigned_to = admin_id
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "assigned_to": admin_id}
