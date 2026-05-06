"""
HTML sanitization utility — whitelist-based.
Used for any user/admin-submitted HTML content.
"""
import bleach

# Safe tags for rich content (announcements, blog, support pages)
ALLOWED_TAGS = [
    "a", "abbr", "b", "blockquote", "br", "code", "div", "em",
    "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
    "li", "ol", "p", "pre", "span", "strong", "sub", "sup",
    "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
]

ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "width", "height", "style"],
    "span": ["style"],
    "div": ["style"],
    "td": ["colspan", "rowspan", "style"],
    "th": ["colspan", "rowspan", "style"],
    "table": ["style"],
}

# Restrict protocols
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(html: str) -> str:
    """Sanitize HTML content, allowing only safe tags and attributes."""
    if not html:
        return ""
    return bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )


def sanitize_text(text: str) -> str:
    """Strip ALL HTML tags — plain text only."""
    if not text:
        return ""
    return bleach.clean(text, tags=[], strip=True)
