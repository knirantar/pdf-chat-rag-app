from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI")

client = AsyncIOMotorClient(MONGO_URI)
db = client["pdf_chat"]

users_col = db["users"]
pdfs_col = db["pdfs"]
pdf_summaries_col = db["pdf_summaries"]

