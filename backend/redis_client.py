import redis
import os

REDIS_URL = os.getenv("REDIS_URL")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

CHAT_TTL_SECONDS = 60 * 60 * 24  # 24 hours