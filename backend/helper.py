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
    # Fix bold spacing
    text = re.sub(r"\*\*\s+(.*?)\s+\*\*", r"**\1**", text)

    # 🔥 FIX: ensure blank line before numbered lists
    text = re.sub(r'([^\n])(\d+\.\s)', r'\1\n\n\2', text)

    # 🔥 FIX: ensure blank line before bullet lists
    text = re.sub(r'([^\n])(-\s)', r'\1\n\n\2', text)

    # Headings on new lines
    text = re.sub(r"(#+)([^\n])", r"\1 \2", text)

    # Ensure blank line before headings
    text = re.sub(r"\n(#+)", r"\n\n\1", text)

    # Normalize excessive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


