import hashlib
import numpy as np
import os
from openai import OpenAI
import re

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
embed_model = os.getenv("EMBED_MODEL", "text-embedding-3-large")    

def compute_pdf_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()

def embed_texts(texts: list[str], batch_size: int = 100) -> np.ndarray:
    clean_texts = [t.strip() for t in texts if isinstance(t, str) and len(t.strip()) > 20]
    if not clean_texts:
        raise ValueError("No valid text chunks to embed")

    all_embeddings = []

    for i in range(0, len(clean_texts), batch_size):
        batch = clean_texts[i:i + batch_size]
        response = client.embeddings.create(
            model=embed_model,
            input=batch
        )
        batch_vectors = [d.embedding for d in response.data]
        all_embeddings.extend(batch_vectors)

    return np.array(all_embeddings, dtype="float32")

def embed_query(text: str) -> np.ndarray:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Empty query")

    response = client.embeddings.create(
        model=embed_model,
        input=text.strip()
    )
    return np.array([response.data[0].embedding], dtype="float32")

def normalize_markdown(text: str) -> str:
    # Fix headings
    text = re.sub(r"(#+)([^\n])", r"\1 \2", text)
    text = re.sub(r"\n(#+)", r"\n\n\1", text)

    # Fix numbered lists
    text = re.sub(r'([^\n])(\d+\.\s)', r'\1\n\n\2', text)

    # Fix bullet lists
    text = re.sub(r'([^\n])(-\s)', r'\1\n\n\2', text)

    # Normalize newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

def fix_tokenization(text: str) -> str:
    """
    Re-join broken subword tokens caused by streaming
    """
    # Join common English splits
    text = re.sub(r"(\b[A-Za-z]{2,})\s+([a-z]{2,}\b)", r"\1\2", text)

    # Fix hyphenated breaks
    text = re.sub(r"-\s+", "-", text)

    # Fix multiple spaces
    text = re.sub(r"\s{2,}", " ", text)

    return text

def is_fact_question(q: str) -> bool:
    q = q.lower().strip()
    return (
        q.startswith("who ")
        or q.startswith("is there")
        or q.startswith("how many")
        or q.startswith("which author")
        or q.startswith("name ")
    )

def dedupe_chunks(chunks: list[str]) -> list[str]:
    seen = set()
    deduped = []
    for c in chunks:
        key = c.strip().lower()
        if key not in seen:
            seen.add(key)
            deduped.append(c)
    return deduped

def clean_context(text: str) -> str:
    sentences = sent_tokenize(text)
    clean = []
    for s in sentences:
        s = s.strip()
        if len(s) > 20 and not s.lower().startswith("page"):
            clean.append(s)
    return "\n".join(clean)

