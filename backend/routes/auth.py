from fastapi import APIRouter, HTTPException
from backend.auth.google import verify_google_id_token
from backend.auth.jwt_utils import create_jwt
from backend.db.mongo import users_col
from datetime import datetime, timezone

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/google")
async def google_login(payload: dict):
    token = payload.get("id_token")
    if not token:
        raise HTTPException(400, "Missing id_token")

    google_user = verify_google_id_token(token)

    await users_col.update_one(
        {"_id": google_user["sub"]},
        {
            "$set": {
                "email": google_user["email"],
                "name": google_user.get("name"),
                "picture": google_user.get("picture"),
                "last_login": datetime.now(timezone.utc)
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )

    jwt_token = create_jwt({
        "sub": google_user["sub"],
        "email": google_user["email"],
        "name": google_user.get("name"),
        "picture": google_user.get("picture")
    })

    return {
        "access_token": jwt_token,
        "token_type": "bearer"
    }
