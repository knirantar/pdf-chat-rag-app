from fastapi import APIRouter, HTTPException
from backend.auth.google import verify_google_id_token
from backend.auth.jwt_utils import create_jwt

auth_router = APIRouter(prefix="/auth", tags=["auth"])

@auth_router.post("/google")
def google_login(payload: dict):
    token = payload.get("id_token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing id_token")

    google_user = verify_google_id_token(token)

    jwt_token = create_jwt({
        "sub": google_user["sub"],
        "email": google_user["email"],
        "name": google_user.get("name")
    })

    return {
        "access_token": jwt_token,
        "token_type": "bearer"
    }