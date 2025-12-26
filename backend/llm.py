from openai import OpenAI
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

# --------------------------------------------------
# Core LLM Call
# --------------------------------------------------
def generate_answer(prompt: str):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    return response.choices[0].message.content.strip()


# --------------------------------------------------
# STRICT PROMPT (NO FAKE SOURCES POSSIBLE)
# --------------------------------------------------
def build_prompt(
    context: str,
    question: str,
    history: list,
    answer_mode: str = "strict"  # "strict" | "hybrid"
):
    history_block = ""
    for msg in history[-6:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        history_block += f"{role}: {msg['content']}\n"

    if answer_mode == "strict":
        rules = """
Rules:
- Use ONLY the document context provided below.
- If the answer is not explicitly and clearly present, say:
  "The document does not contain this information."
- Structure the answer using headings and bullet points where appropriate.
- Do NOT use general knowledge.
- Do NOT infer, guess, or extrapolate.
- Do NOT mention sources, pages, PDFs, confidence, or metadata.
- Answer in plain text only.
"""
    else:  # hybrid
        rules = """
Rules:
- Prefer the document context when it is relevant.
- If the document does not fully answer the question:
  - You MAY use general knowledge to explain the concept.
- Structure the answer using headings and bullet points where appropriate.
- If document context is used, relate your explanation to it.
- Clearly explain concepts in simple language.
- Do NOT fabricate document-specific facts.
- Do NOT mention sources, pages, PDFs, confidence, or metadata.
- Answer in plain text only.
"""

    return f"""
You are a knowledgeable question-answering assistant.

{rules}

Conversation History:
{history_block if history_block else "[NO PRIOR CONVERSATION]"}

Document Context:
{context if context else "[NO DOCUMENT CONTEXT]"}

Question:
{question}

Answer:
"""


def answer_question(context: str, question: str, history: list, answer_mode: str = "strict"):
    prompt = build_prompt(context, question, history, answer_mode)
    answer_text = generate_answer(prompt)

    verification = verify_answer(answer_text, context)

    if verification["supported"]:
        if verification["strength"] == "strong":
            answer_type = "DOCUMENT"
            confidence = 0.8
        else:
            answer_type = "MIXED"
            confidence = 0.4
    else:
        answer_type = "GENERAL_KNOWLEDGE"
        confidence = 0.1

    return {
        "text": answer_text,
        "answer_type": answer_type,
        "confidence": confidence
    }


# --------------------------------------------------
# VERIFICATION STEP (ANTI-HALLUCINATION)
# --------------------------------------------------
def verify_answer(answer: str, context: str):
    prompt = f"""
You are a verifier.

Check if the answer is DIRECTLY supported by the document context.

Document Context:
{context if context else "[EMPTY]"}

Answer:
{answer}

Rules:
- If answer relies on general world knowledge → NOT supported
- If answer is only implied → weak
- If answer is explicitly stated → strong

Return ONLY valid JSON:
{{
  "supported": true | false,
  "strength": "strong" | "weak" | "none"
}}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    try:
        return json.loads(response.choices[0].message.content)
    except Exception:
        return {"supported": False, "strength": "none"}

def stream_answer(context: str, question: str, history: list, answer_mode: str):
    prompt = build_prompt(context, question, history, answer_mode)

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        stream=True
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content
