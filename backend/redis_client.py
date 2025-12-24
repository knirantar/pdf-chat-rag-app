import redis
import os

import os
import redis
import ssl
import logging

REDIS_URL = os.getenv("REDIS_URL")
CHAT_TTL_SECONDS = 60 * 60  # 1 hour

redis_client = None

if REDIS_URL:
    try:
        redis_client = redis.from_url(
            REDIS_URL,
            decode_responses=True,
            ssl_cert_reqs=ssl.CERT_NONE,  # REQUIRED for Upstash
            socket_connect_timeout=10,
            socket_timeout=10,
            retry_on_timeout=True,
        )
        redis_client.ping()
        logging.info("✅ Connected to Upstash Redis")
    except Exception as e:
        logging.error(f"❌ Redis connection failed: {e}")
        redis_client = None
else:
    logging.warning("⚠️ REDIS_URL not set")


