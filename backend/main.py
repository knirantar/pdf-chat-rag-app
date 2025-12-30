from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import fitz
import numpy as np
import faiss
import pickle
from backend.chat_memory import get_chat_history, save_chat_message,reset_chat
from nltk.tokenize import sent_tokenize
from backend.llm import answer_question, verify_answer  # ✅ IMPORTANT
from backend.helper import compute_pdf_hash, embed_texts,embed_query, normalize_markdown, clean_context, dedupe_chunks
from backend.auth.dependencies import get_current_user
from fastapi import Depends
from backend.routes.auth import auth_router
from backend.routes.pdfs import pdf_router
from backend.llm import stream_answer
from backend.db.mongo import pdfs_col
from datetime import datetime, timezone



EMBED_DIM = 3072
MAX_CHARS = 900
OVERLAP_CHARS = 150

# -------------------- CONFIG --------------------
UPLOAD_DIR = Path("uploads")
INDEX_ROOT = Path("/data/indexes")
max_chars = int(MAX_CHARS)
overlap_chars = int(OVERLAP_CHARS)
INDEX_ROOT.mkdir(exist_ok=True)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
INDEX_ROOT.mkdir(parents=True, exist_ok=True)

# -------------------- APP --------------------
app = FastAPI(title="PDF RAG Chat Backend")

app.include_router(auth_router)
app.include_router(pdf_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type"],
)


# -------------------- HELPERS --------------------
def extract_pages(pdf_path: Path):
    pages = []

    with fitz.open(pdf_path) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()
            if text:
                pages.append({
                    "page": page_num,
                    "text": text
                })

    return pages

def split_paragraphs(text: str):
    paragraphs = []
    raw_blocks = text.split("\n\n")
    for block in raw_blocks:
        block = block.strip()
        if len(block) >= 20 or any(k in block.lower() for k in ["author", "isbn", "title"]):
            paragraphs.append(block)
    return paragraphs


def build_semantic_chunks(paragraphs):
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        sentences = sent_tokenize(para)

        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= max_chars:
                current_chunk += " " + sentence
            else:
                chunks.append(current_chunk.strip())
                current_chunk = sentence[-overlap_chars:]

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks

def semantic_chunk_pdf(pdf_path: Path, source_name: str):
    chunks = []

    pages = extract_pages(pdf_path)

    for page_data in pages:
        paragraphs = split_paragraphs(page_data["text"])
        semantic_chunks = build_semantic_chunks(paragraphs)

        for chunk in semantic_chunks:
            chunks.append({
                "text": chunk,
                "source": source_name,
                "page": page_data["page"]
            })

    return chunks

def cosine_similarity(normalized_query, normalized_vectors):
    """
    Since embeddings are normalized, cosine similarity = dot product
    """
    return np.dot(normalized_query, normalized_vectors.T)
# -------------------- API MODELS --------------------
class AskRequest(BaseModel):
    question: str
    conversation_id: str
    pdf_id: str
    answer_mode: str  # "strict" or "hybrid"

# -------------------- ROUTES --------------------
@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), user=Depends(get_current_user)):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF allowed")

    file_bytes = await file.read()
    pdf_id = compute_pdf_hash(file_bytes)

    pdf_path = UPLOAD_DIR / f"{pdf_id}.pdf"
    if not pdf_path.exists():
        pdf_path.write_bytes(file_bytes)

    # Mongo metadata
    await pdfs_col.update_one(
        {"_id": pdf_id},
        {
            "$set": {
                "name": file.filename,
                "owner": user["sub"],
                "uploaded_at": datetime.now(timezone.utc),
                "indexed": False
            }
        },
        upsert=True
    )

    pdf_index_dir = INDEX_ROOT / pdf_id
    index_path = pdf_index_dir / "index.faiss"
    docs_path = pdf_index_dir / "documents.pkl"

    # If index exists → reuse
    if index_path.exists() and docs_path.exists():
        return {
            "pdf_id": pdf_id,
            "message": "PDF already indexed, reusing existing index"
        }

    pdf_index_dir.mkdir(parents=True, exist_ok=True)

    # ---- Chunk & embed ----
    chunks = semantic_chunk_pdf(pdf_path, file.filename)
    texts = [c["text"] for c in chunks if len(c["text"].strip()) > 10]

    embeddings = embed_texts(texts)
    faiss.normalize_L2(embeddings)

    index = faiss.IndexFlatL2(EMBED_DIM)
    index.add(embeddings)

    # ---- Persist ----
    faiss.write_index(index, str(index_path))
    with open(docs_path, "wb") as f:
        pickle.dump(chunks, f)

    # Mark indexed
    await pdfs_col.update_one(
        {"_id": pdf_id},
        {"$set": {"indexed": True}}
    )

    return {
        "pdf_id": pdf_id,
        "message": "PDF indexed successfully",
        "chunks": len(chunks)
    }

@app.post("/ask")
def ask(req: AskRequest, user=Depends(get_current_user)):
    doc = pdfs_col.find_one({
        "_id": req.pdf_id,
        "owner": user["sub"],
        "indexed": True
    })

    if not doc:
        raise HTTPException(403, "Access denied or PDF not indexed")

    pdf_index_dir = INDEX_ROOT / req.pdf_id
    index_path = pdf_index_dir / "index.faiss"
    docs_path = pdf_index_dir / "documents.pkl"

    if not index_path.exists():
        raise HTTPException(404, "Index not found")

    index = faiss.read_index(str(index_path))
    with open(docs_path, "rb") as f:
        documents = pickle.load(f)

    q_emb = embed_query(req.question)
    faiss.normalize_L2(q_emb)

    k = min(15, index.ntotal)
    distances, ids = index.search(q_emb, k)

    relevant_chunks = []
    sources = set()

    for dist, i in zip(distances[0], ids[0]):
        if i == -1:
            continue
        sim = 1 - dist / 2
        if sim < 0.25:
            continue
        d = documents[i]
        relevant_chunks.append(d["text"])
        sources.add(f"{d['source']} (Page {d['page']})")

    context = clean_context("\n\n".join(dedupe_chunks(relevant_chunks)))
    history = get_chat_history(req.conversation_id)

    result = answer_question(context, req.question, history, req.answer_mode)
    verification = verify_answer(result["text"], context)

    save_chat_message(req.conversation_id, "user", req.question)
    save_chat_message(req.conversation_id, "assistant", result["text"])

    return {
        "messages": [{"role": "assistant", "content": normalize_markdown(result["text"])}],
        "confidence": 0.8 if verification["supported"] else 0.3,
        "sources": list(sources) if verification["supported"] else []
    }


@app.post("/reset-chat/{conversation_id}")
def reset_chat_api(conversation_id: str):
    reset_chat(conversation_id)
    return {"message": "Chat reset"}
