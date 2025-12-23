import json
from backend.redis_client import redis_client, CHAT_TTL_SECONDS

def get_chat_history(conversation_id: str):
    key = f"chat:{conversation_id}"
    data = redis_client.get(key)
    return json.loads(data) if data else []

def save_chat_message(conversation_id: str, role: str, content: str):
    key = f"chat:{conversation_id}"

    history = get_chat_history(conversation_id)
    history.append({
        "role": role,
        "content": content
    })

    redis_client.setex(
        key,
        CHAT_TTL_SECONDS,
        json.dumps(history)
    )

def reset_chat(conversation_id: str):
    redis_client.delete(f"chat:{conversation_id}")

if __name__ == "__main__":
    pass
