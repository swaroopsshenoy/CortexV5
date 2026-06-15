import os
import subprocess
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("cortex-cmake")


def _run(args: list[str], cwd: str = ".") -> dict[str, Any]:
    result = subprocess.run(
        args,
        cwd=cwd,
        capture_output=True,
        text=True,
        shell=False,
    )
    return {
        "command": args,
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "cwd": os.path.abspath(cwd),
    }


@mcp.tool()
def configure(
    source_dir: str = ".",
    build_dir: str = "build",
    generator: str = "",
    build_type: str = "Debug",
) -> dict[str, Any]:
    """
    Run CMake configure step.
    """
    args = ["cmake", "-S", source_dir, "-B", build_dir, f"-DCMAKE_BUILD_TYPE={build_type}"]
    if generator:
        args.extend(["-G", generator])
    return _run(args)


@mcp.tool()
def build(build_dir: str = "build", target: str = "", config: str = "Debug") -> dict[str, Any]:
    """
    Run CMake build step.
    """
    args = ["cmake", "--build", build_dir, "--config", config]
    if target:
        args.extend(["--target", target])
    return _run(args)


@mcp.tool()
def test(build_dir: str = "build", output_on_failure: bool = True) -> dict[str, Any]:
    """
    Run CTest in the given build directory.
    """
    args = ["ctest", "--test-dir", build_dir]
    if output_on_failure:
        args.append("--output-on-failure")
    return _run(args)


if __name__ == "__main__":
    mcp.run()
