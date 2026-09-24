"""Shared config: load API keys from .env and build chat models by name."""

import os

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain.embeddings import init_embeddings

load_dotenv()

DEFAULT_MODEL = os.getenv("ROBOT_MODEL", "google_genai:gemini-3.7-flash")
LOCAL_MODEL = os.getenv("LOCAL_MODEL", "ollama:qwen3:8b")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "google_genai:gemini-embedding-001")


def get_model(name: str | None = None, **kwargs):
    """Return a chat model. Swapping the robot's brain is one string."""
    return init_chat_model(name or DEFAULT_MODEL, temperature=0, **kwargs)


def get_embeddings(name: str | None = None):
    """Return an embeddings model (used by RAG in chapter 2c)."""
    return init_embeddings(name or EMBEDDINGS_MODEL)
