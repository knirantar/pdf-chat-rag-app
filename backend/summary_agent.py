from backend.db.mongo import pdf_summaries_col
from backend.helper import clean_context
from backend.llm import answer_question
from pathlib import Path
import pickle, faiss
from datetime import datetime, timezone


def load_index_and_docs(user_id: str, pdf_id: str):
    base = Path("/data/indexes") / user_id / pdf_id
    with open(base / "documents.pkl", "rb") as f:
        docs = pickle.load(f)
    index = faiss.read_index(str(base / "index.faiss"))
    return index, docs


async def run_summary_agent(
    pdf_id: str,
    user_id: str,
    force: bool = False
):
    existing = await pdf_summaries_col.find_one({
        "pdf_id": pdf_id,
        "user_id": user_id
    })

    if existing and not force:
        return existing

    _, docs = load_index_and_docs(user_id, pdf_id)

    # Use distributed chunks, not only first ones
    rep_chunks = docs[::max(1, len(docs) // 25)]
    rep_text = clean_context("\n\n".join(d["text"] for d in rep_chunks[:30]))

    # -------- Overview --------
    overview_resp = answer_question(
        rep_text,
        "Give a concise, high-level summary of this document.",
        [],
        "hybrid"
    )

    overview = overview_resp["text"].strip()

    # -------- Smart Questions --------
    questions_prompt = f"""
You are an expert reader.

Based on the summary below, generate 10 insightful questions that help a reader deeply understand the document.
Mix:
- conceptual questions
- evidence-based questions
- critical thinking questions
- Each question must be SHORT (max 12 words)
- One clear idea per question
- Conversational, natural language
- No markdown
- No headings
- No explanations
- No prefixes
- Only plain questions
- Every item must end with a question mark

Avoid yes/no questions.c
Avoid generic phrasing.

Summary:
{overview}
"""

    questions_resp = answer_question(
        overview,
        questions_prompt,
        [],
        "hybrid"
    )

    questions = [
        q.strip("-•1234567890. ").strip()
        for q in questions_resp["text"].split("\n")
        if len(q.strip()) > 10
    ][:10]
    suggested_questions = clean_questions(questions)

    version = (existing.get("version", 0) + 1) if existing else 1

    summary_doc = {
        "pdf_id": pdf_id,
        "user_id": user_id,
        "overview": overview,
        "suggested_questions": suggested_questions,
        "version": version,
        "updated_at": datetime.now(timezone.utc)
    }

    await pdf_summaries_col.update_one(
        {"pdf_id": pdf_id, "user_id": user_id},
        {"$set": summary_doc},
        upsert=True
    )

    return summary_doc

def clean_questions(questions: list[str]) -> list[str]:
    cleaned = []
    for q in questions:
        q = q.strip()

        # ❌ remove markdown headings
        if q.startswith("#"):
            continue

        # ❌ remove titles / labels
        if not q.endswith("?"):
            continue

        # ❌ too long (UX constraint)
        if len(q) > 120:
            continue

        cleaned.append(q)

    return cleaned
