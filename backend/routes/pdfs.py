from backend.db.mongo import pdfs_col
from backend.auth.dependencies import get_current_user
from fastapi import Depends
from fastapi import APIRouter, HTTPException

pdf_router = APIRouter(prefix="/pdfs", tags=["pdfs"])

@pdf_router.get("/")
async def list_pdfs(user=Depends(get_current_user)):
    cursor = pdfs_col.find({"owner": user["sub"]})
    pdfs = []

    async for doc in cursor:
        pdfs.append({
            "id": doc["_id"],
            "name": doc["name"]
        })

    return pdfs
