from typing import Optional

def mask_secret(secret: Optional[str]) -> str:
    """Masks sensitive API keys for safe UI/logging display."""
    if not secret:
        return ""
    if len(secret) <= 8:
        return "********"
    return f"{secret[:3]}...{secret[-4:]}"

def sanitize_error_message(error: Exception) -> str:
    """Returns a safe, human-readable error message without leaking sensitive credentials."""
    msg = str(error)
    # Generic replacement of potential key-like patterns
    import re
    cleaned = re.sub(r"sk-[a-zA-Z0-9_-]{20,}", "sk-***", msg)
    return cleaned[:500]
