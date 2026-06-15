import argparse
import json
import sys


def location_to_json(location):
    if location is None or location.file is None:
        return None
    return {
        "file": str(location.file),
        "line": int(location.line),
        "column": int(location.column),
    }


def cursor_to_json(cursor, max_depth, current_depth=0):
    node = {
        "kind": str(cursor.kind),
        "spelling": cursor.spelling or None,
        "displayname": cursor.displayname or None,
        "type": cursor.type.spelling if cursor.type is not None else None,
        "location": location_to_json(cursor.location),
        "children": [],
    }
    if current_depth >= max_depth:
        return node

    for child in cursor.get_children():
        node["children"].append(cursor_to_json(child, max_depth, current_depth + 1))
    return node


def diagnostics_to_json(translation_unit):
    diagnostics = []
    for diagnostic in translation_unit.diagnostics:
        diagnostics.append(
            {
                "severity": int(diagnostic.severity),
                "spelling": diagnostic.spelling,
                "location": location_to_json(diagnostic.location),
            }
        )
    return diagnostics


def create_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--depth", type=int, default=60)
    parser.add_argument("clang_args", nargs="*")
    return parser


def main():
    args = create_parser().parse_args()
    try:
        from clang import cindex
    except ImportError:
        sys.stderr.write("CINDEX_UNAVAILABLE: clang.cindex import failed\n")
        return 3

    try:
        index = cindex.Index.create()
    except cindex.LibclangError as error:
        sys.stderr.write(f"LIBCLANG_UNAVAILABLE: {error}\n")
        return 4

    try:
        translation_unit = index.parse(args.source, args=args.clang_args)
    except Exception as error:  # explicit error propagation to stderr
        sys.stderr.write(f"CINDEX_PARSE_FAILED: {error}\n")
        return 2

    payload = {
        "format": "clang-cindex-json",
        "translationUnit": cursor_to_json(translation_unit.cursor, max_depth=max(1, args.depth)),
        "diagnostics": diagnostics_to_json(translation_unit),
    }
    sys.stdout.write(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
