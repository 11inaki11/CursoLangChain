"""
Chapter 2c — RAG is just another tool.

We embed the robot manuals (data/manuals/*.md or *.pdf), put them in a
vector store and expose the retriever as a tool the robot can call.
Run:  python ch2c_rag.py
"""

from pathlib import Path

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ch2b_tools import make_robot_tools
from config import get_embeddings, get_model
from robot_world import WORLD

MANUALS_DIR = Path(__file__).parent / "data" / "manuals"


def load_manuals() -> list[Document]:
    docs = []
    for path in sorted(MANUALS_DIR.iterdir()):
        if path.suffix in {".md", ".txt"}:
            docs.append(Document(page_content=path.read_text(), metadata={"source": path.name}))
        elif path.suffix == ".pdf":
            from pypdf import PdfReader

            for i, page in enumerate(PdfReader(path).pages, start=1):
                docs.append(Document(page_content=page.extract_text() or "", metadata={"source": path.name, "page": i}))
    return docs


def build_manual_tool(k: int = 3):
    """Embed the manuals once and return a `search_manuals` tool."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
    chunks = splitter.split_documents(load_manuals())
    store = InMemoryVectorStore.from_documents(chunks, get_embeddings())  # text -> vectors
    retriever = store.as_retriever(search_kwargs={"k": k})               # top-k nearest chunks

    @tool
    def search_manuals(query: str) -> str:
        """Search the R-80 service manual and the lab safety rules (specs, limits, zones, error codes)."""
        hits = retriever.invoke(query)
        return "\n\n".join(f"[{d.metadata['source']}] {d.page_content}" for d in hits)

    return search_manuals


SYSTEM_PROMPT = (
    "You are R-80, a lab robot. Before doing anything that could break a rule "
    "or a hardware limit, check the manuals with search_manuals. Be brief."
)

if __name__ == "__main__":
    WORLD.add_robot("r80")
    agent = create_agent(
        model=get_model(),
        tools=make_robot_tools("r80") + [build_manual_tool()],
        system_prompt=SYSTEM_PROMPT,
    )
    question = "Fetch the sensor kit from shelf_b. Is there any rule I should know about zone B?"
    result = agent.invoke({"messages": [{"role": "user", "content": question}]})
    for message in result["messages"]:
        message.pretty_print()
