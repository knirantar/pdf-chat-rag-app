from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import fitz
import numpy as np
import faiss
from backend.chat_memory import get_chat_history, save_chat_message,reset_chat
from nltk.tokenize import sent_tokenize
from backend.llm import answer_question, verify_answer  # ✅ IMPORTANT
from backend.helper import compute_pdf_hash, embed_texts, embed_query, normalize_markdown
from backend.auth.dependencies import get_current_user
from fastapi import Depends
from backend.routes.auth import auth_router
from fastapi.responses import StreamingResponse
from backend.llm import stream_answer


EMBED_DIM = 3072
MAX_CHARS = 900
OVERLAP_CHARS = 150

# -------------------- CONFIG --------------------
UPLOAD_DIR = Path("uploads")
INDEX_ROOT = Path("indexes")
max_chars = int(MAX_CHARS)
overlap_chars = int(OVERLAP_CHARS)
INDEX_ROOT.mkdir(exist_ok=True)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
INDEX_ROOT.mkdir(parents=True, exist_ok=True)

# -------------------- APP --------------------
app = FastAPI(title="PDF RAG Chat Backend")

app.include_router(auth_router)

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


    # Save PDF
    pdf_path = UPLOAD_DIR / f"{pdf_id}.pdf"
    
    if not pdf_path.exists():
        with open(pdf_path, "wb") as f:
            f.write(file_bytes)
    else:
        print("PDF already exists, reusing existing file")

    # Create index directory
    pdf_index_dir = INDEX_ROOT / pdf_id
    if pdf_index_dir.exists():
        print("PDF already indexed, reusing existing index")
        return {
            "pdf_id": pdf_id,
            "message": "PDF already indexed, reusing existing index"
        }
    pdf_index_dir.mkdir(parents=True)

    # Create NEW index + documents
    index = faiss.IndexFlatL2(int(EMBED_DIM))
    documents = []

    # Chunk & embed
    chunks = semantic_chunk_pdf(pdf_path, file.filename)

    filtered_chunks = [
        c for c in chunks
        if isinstance(c["text"], str) and len(c["text"].strip()) > 10
    ]

    texts = [c["text"] for c in filtered_chunks]
    embeddings = embed_texts(texts)
    faiss.normalize_L2(embeddings)
    index.add(embeddings)
    documents.extend(filtered_chunks)


    # Persist
    faiss.write_index(index, str(pdf_index_dir / "faiss.index"))
    np.save(pdf_index_dir / "documents.npy", documents)

    return {
        "pdf_id": pdf_id,
        "message": "PDF indexed successfully",
        "chunks": len(chunks),
        "msg": f"PDF uploaded by {user['email']}"
    }

@app.post("/ask")
def ask(req: AskRequest):
    answer_mode = req.answer_mode  # "strict" or "hybrid"
    pdf_index_dir = INDEX_ROOT / req.pdf_id
    index_path = pdf_index_dir / "faiss.index"
    docs_path = pdf_index_dir / "documents.npy"

    if not index_path.exists() or not docs_path.exists():
        raise HTTPException(404, "PDF index not found")

    # Load FAISS index and documents
    index = faiss.read_index(str(index_path))
    documents = list(np.load(docs_path, allow_pickle=True))

    if index.ntotal == 0:
        raise HTTPException(400, "No vectors in index")

    # Embed and normalize the query
    q_emb = embed_query(req.question)
    faiss.normalize_L2(q_emb)

    # Search in FAISS index (L2 distance on normalized vectors)
    k = min(20, index.ntotal)  # retrieve up to 20 candidates
    distances, ids = index.search(q_emb, k=k)

    # Convert to cosine similarity (for normalized vectors)
    similarities = 1 - distances / 2  # cosine similarity approximation

    relevant_chunks = []
    sources = set()
    SIM_THRESHOLD = 0.25  # Accept even loose matches for context

    for sim, i in zip(similarities[0], ids[0]):
        if i == -1 or sim < SIM_THRESHOLD:
            continue

        doc = documents[i]
        relevant_chunks.append(doc["text"])
        sources.add(f"{doc['source']} (Page {doc.get('page', 'N/A')})")

    # Merge chunks into context
    context = "\n\n".join(relevant_chunks)

    # Debug: Check context length
    print("---- CONTEXT LENGTH ----", len(context))
    print("---- CONTEXT PREVIEW ----", context[:500])

    # Load chat history
    history = get_chat_history(req.conversation_id)

    # Generate answer with context
    result = answer_question(context, req.question, history, answer_mode)

    # Verify answer to reduce hallucination
    verification = verify_answer(result["text"], context)
    
    # Save chat messages
    save_chat_message(req.conversation_id, "user", req.question)
    save_chat_message(req.conversation_id, "assistant", result["text"])

    result['text'] = normalize_markdown(result['text'])

    return {
        "messages": [{"role": "assistant", "content": result["text"]}],
        "answer_type": result.get("answer_type", "DOCUMENT"),
        "confidence": round(result.get("confidence", 0.8), 2),
        "sources": (
            list(sources)
            if verification["supported"] and verification["strength"] == "strong"
            else []
        ),
    }

@app.post("/reset-chat/{conversation_id}")
def reset_chat_api(conversation_id: str):
    reset_chat(conversation_id)
    return {"message": "Chat reset"}

@app.post("/ask-stream")
def ask_stream(req: AskRequest, user=Depends(get_current_user)):
    pdf_index_dir = INDEX_ROOT / req.pdf_id
    index_path = pdf_index_dir / "faiss.index"
    docs_path = pdf_index_dir / "documents.npy"

    if not index_path.exists() or not docs_path.exists():
        raise HTTPException(404, "PDF index not found")

    # Load FAISS
    index = faiss.read_index(str(index_path))
    documents = list(np.load(docs_path, allow_pickle=True))

    # Embed query
    q_emb = embed_query(req.question)
    faiss.normalize_L2(q_emb)

    distances, ids = index.search(q_emb, k=min(20, index.ntotal))

    relevant_chunks = []
    for d, i in zip(distances[0], ids[0]):
        if i != -1:
            relevant_chunks.append(documents[i]["text"])

    context = "\n\n".join(relevant_chunks)

    history = get_chat_history(req.conversation_id)

    def event_generator():
        # Stream tokens
        for token in stream_answer(
            context,
            req.question,
            history,
            req.answer_mode
        ):
            yield f"data:{token}\n\n"

        # Save chat AFTER completion
        save_chat_message(req.conversation_id, "user", req.question)
        save_chat_message(req.conversation_id, "assistant", "[STREAMED]")

        yield "data:[DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
