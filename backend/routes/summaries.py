from fastapi import APIRouter, Depends, HTTPException
from backend.db.mongo import pdf_summaries_col
from backend.auth.dependencies import get_current_user
from backend.summary_agent import run_summary_agent

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.get("/{pdf_id}")
async def get_summary(pdf_id: str, user=Depends(get_current_user)):
    doc = await pdf_summaries_col.find_one(
        {"pdf_id": pdf_id, "user_id": user["sub"]},
        {"_id": 0}
    )

    if not doc:
        raise HTTPException(404, "Summary not found")

    return doc


@router.post("/{pdf_id}")
async def create_summary(pdf_id: str, user=Depends(get_current_user)):
    result = await run_summary_agent(
        pdf_id=pdf_id,
        user_id=user["sub"],
        force=False
    )
    return {"status": "ok", "version": result["version"]}


@router.post("/{pdf_id}/regenerate")
async def regenerate_summary(pdf_id: str, user=Depends(get_current_user)):
    result = await run_summary_agent(
        pdf_id=pdf_id,
        user_id=user["sub"],
        force=True
    )
    return {"status": "regenerated", "version": result["version"]}
