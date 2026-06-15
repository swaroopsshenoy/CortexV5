import os
from typing import Any

import requests
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("cortex-perplexity-search")


@mcp.tool()
def search(query: str, model: str = "sonar-pro") -> dict[str, Any]:
    """
    Query Perplexity's API for real-time research.
    Requires env var: PPLX_API_KEY
    """
    api_key = os.getenv("PPLX_API_KEY")
    if not api_key:
        raise ValueError("Missing PPLX_API_KEY environment variable.")

    response = requests.post(
        "https://api.perplexity.ai/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": query}],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    citations = data.get("citations", [])
    return {"answer": content, "citations": citations}


if __name__ == "__main__":
    mcp.run()
