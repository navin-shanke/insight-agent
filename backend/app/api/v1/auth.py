"""Single-user JWT authentication for Phase 5 dashboard.

Implements password verification using bcrypt against a bcrypt hash stored
in environment config and issues HS256 JWT bearer tokens. All non-health API
endpoints require a valid bearer token.

Environment variables (set in .env):
    AUTH_SECRET_KEY      — random secret for signing JWTs
    ADMIN_USERNAME       — dashboard login username
    ADMIN_PASSWORD_HASH  — bcrypt hash of the dashboard password
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

from app.core.config import get_settings
from app.schemas.api.auth import TokenResponse, TokenData

router = APIRouter(prefix="/auth", tags=["auth"])

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours — local single-user session


def _verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    settings = get_settings()
    if not settings.auth_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTH_SECRET_KEY is not configured. Set it in .env before using the dashboard.",
        )
    return jwt.encode(to_encode, settings.auth_secret_key, algorithm=_ALGORITHM)


async def get_current_user(token: str = Depends(_oauth2_scheme)) -> TokenData:
    """Dependency that validates the bearer JWT and returns the token payload."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    settings = get_settings()
    if not settings.auth_secret_key:
        raise credentials_exc
    try:
        payload = jwt.decode(token, settings.auth_secret_key, algorithms=[_ALGORITHM])
        sub: str | None = payload.get("sub")
        if sub is None:
            raise credentials_exc
        return TokenData(sub=sub)
    except JWTError:
        raise credentials_exc


@router.post("/token", response_model=TokenResponse, summary="Obtain a JWT bearer token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    """Verify username + password and issue a bearer token.

    Credentials are checked against ADMIN_USERNAME and ADMIN_PASSWORD_HASH
    from environment config.
    """
    settings = get_settings()

    # Graceful error when auth is not yet configured
    if not settings.admin_username or not settings.admin_password_hash:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Authentication is not configured. "
                "Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH in .env."
            ),
        )

    username_ok = form_data.username == settings.admin_username
    password_ok = (
        username_ok
        and _verify_password(form_data.password, settings.admin_password_hash)
    )

    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _create_access_token({"sub": form_data.username})
    return TokenResponse(access_token=token)
