import os
import shlex
import subprocess
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("cortex-shell")

ALLOWED_EXECUTABLES = {
    "cmake",
    "ctest",
    "ninja",
    "clang",
    "clang++",
    "gcc",
    "g++",
    "python",
    "pip",
    "node",
    "npm",
}

BLOCKED_TOKENS = {"&&", "||", ";", "|", ">", ">>", "<"}


def _parse_first_token(command: str) -> str:
    parts = shlex.split(command, posix=False)
    if not parts:
        raise ValueError("Command is empty.")
    return os.path.basename(parts[0]).lower()


def _validate_command(command: str) -> None:
    if any(token in command for token in BLOCKED_TOKENS):
        raise ValueError("Command contains blocked shell control tokens.")
    exe = _parse_first_token(command)
    if exe not in ALLOWED_EXECUTABLES:
        allowed = ", ".join(sorted(ALLOWED_EXECUTABLES))
        raise ValueError(f"Executable '{exe}' is not allowlisted. Allowed: {allowed}")


@mcp.tool()
def run_command(command: str, cwd: str = ".") -> dict[str, Any]:
    """
    Run an allowlisted command for builds/tests/tooling.
    """
    _validate_command(command)
    result = subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        shell=True,
    )
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "cwd": os.path.abspath(cwd),
    }


if __name__ == "__main__":
    mcp.run()
