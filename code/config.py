"""Shared config: load API keys from .env and build chat models by name.

You only need ONE provider. If ROBOT_MODEL is empty, the model is picked
from whichever API key you set in .env.
"""

import math
import os
import re
import urllib.request
import zlib

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain.embeddings import init_embeddings
from langchain_core.embeddings import Embeddings

load_dotenv()

# Default model for each provider, keyed by the API key it needs.
PROVIDER_MODELS = {
    "GOOGLE_API_KEY": "google_genai:gemini-3.7-flash",
    "DEEPSEEK_API_KEY": "deepseek:deepseek-chat",
    "OPENAI_API_KEY": "openai:gpt-5.5",
    "ANTHROPIC_API_KEY": "anthropic:claude-sonnet-5",
    "MISTRAL_API_KEY": "mistralai:mistral-large-latest",
}
LOCAL_MODEL = os.getenv("LOCAL_MODEL") or "ollama:qwen3:8b"


def has_key(name: str) -> bool:
    value = (os.getenv(name) or "").strip()
    return bool(value) and not value.startswith("#")


def ollama_running() -> bool:
    url = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/") + "/api/tags"
    try:
        with urllib.request.urlopen(url, timeout=0.5):
            return True
    except OSError:
        return False


def available_models() -> list[str]:
    """Every model you can actually run: one per API key you set, plus Ollama if it's up."""
    models = [model for key, model in PROVIDER_MODELS.items() if has_key(key)]
    if ollama_running():
        models.append(LOCAL_MODEL)
    if (chosen := os.getenv("ROBOT_MODEL")) and chosen not in models:
        models.insert(0, chosen)
    return models


def _pick_default_model() -> str:
    if chosen := (os.getenv("ROBOT_MODEL") or "").strip():
        return chosen
    models = available_models()
    return models[0] if models else ""


DEFAULT_MODEL = _pick_default_model()  # "" when nothing is configured (fine for no-LLM demos)


def get_model(name: str | None = None, **kwargs):
    """Return a chat model. Swapping the robot's brain is one string."""
    if not (name or DEFAULT_MODEL):
        raise SystemExit(
            "No LLM configured. Put one API key in code/.env (e.g. DEEPSEEK_API_KEY=...) "
            "or start Ollama. See .env.example."
        )
    return init_chat_model(name or DEFAULT_MODEL, temperature=0, **kwargs)


# ---------- embeddings (RAG, chapter 2c) ----------
class KeywordEmbeddings(Embeddings):
    """No-key fallback: hashed bag-of-words vectors.

    It matches shared words, not meaning, so it is much weaker than real
    embeddings. It exists so RAG still runs when your provider has no
    embeddings API (DeepSeek, Claude).
    """

    DIM = 1024
    STOP = set("a an the of to in on at for and or is are be it its with by as this that from you your".split())

    def _embed(self, text: str) -> list[float]:
        vec = [0.0] * self.DIM
        for word in re.findall(r"[a-z0-9]+", text.lower()):
            if word not in self.STOP:
                vec[zlib.crc32(word.encode()) % self.DIM] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


def get_embeddings(name: str | None = None) -> Embeddings:
    """Return an embeddings model: the one you chose, a provider you have a key for, or the keyword fallback."""
    name = name or (os.getenv("EMBEDDINGS_MODEL") or "").strip()
    if not name:
        if has_key("GOOGLE_API_KEY"):
            name = "google_genai:gemini-embedding-001"
        elif has_key("OPENAI_API_KEY"):
            name = "openai:text-embedding-3-small"
        else:
            print("[config] No Gemini/OpenAI key: RAG uses a simple local keyword search. "
                  "Set EMBEDDINGS_MODEL in .env for real embeddings.")
            return KeywordEmbeddings()
    return init_embeddings(name)
