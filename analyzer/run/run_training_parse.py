#!/usr/bin/env python3
"""Run parse_fields.py against OCR'd training documents.

This utility is the final step of the toy pipeline used during development.
It walks the training directory, performs OCR on each file (via
``ocr_extract``), and then feeds the resulting text into
``parse_fields`` to extract structured information.  The output is a single
JSON report listing results for every document.

You can invoke the two stages separately if you already have an OCR report;
pass the path to the report with ``--ocr-report``.  Otherwise the script will
run OCR itself for each file, using either direct imports (fast) or by
calling the CLI versions.

Usage:
    python analyzer/run/run_training_parse.py [--dir TRAINING]
                                            [--ocr-report FILE]
                                            [--output FILE]
                                            [--use-cli]

The arguments mirror the other helpers in ``analyzer/run``.


# view help
python3 analyzer/run/run_training_parse.py --help

# default run (re‑OCR each file)
python3 analyzer/run/run_training_parse.py

# supply an existing OCR report to skip step 1
python3 analyzer/run/run_training_parse.py --ocr-report /tmp/ocr.json

# force CLI for both stages
python3 analyzer/run/run_training_parse.py --use-cli


"""

import argparse
import json
import os
import sys
import subprocess

# helpers to import modules from parent directory
base = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if base not in sys.path:
    sys.path.insert(0, base)

# try direct import of both dependencies
try:
    import ocr_extract
    _OCR_DIRECT = True
except Exception:  # pragma: no cover
    _OCR_DIRECT = False

try:
    import parse_fields
    _PARSE_DIRECT = True
except Exception:  # pragma: no cover
    _PARSE_DIRECT = False


def collect_files(root_dir):
    exts = (".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp")
    for dirpath, _, filenames in os.walk(root_dir):
        for fn in filenames:
            if fn.lower().endswith(exts):
                yield os.path.join(dirpath, fn)


def run_ocr_cli(path, ocr_engine=None, ocr_primary=None):
    script = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "ocr_extract.py"))
    cmd = [sys.executable, script, "--file", path]
    if ocr_engine:
        cmd.extend(["--ocr-engine", ocr_engine])
    if ocr_primary:
        cmd.extend(["--ocr-primary", ocr_primary])
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"OCR CLI failed for {path}: {result.stderr}")


def run_parse_cli(raw_text):
    script = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "parse_fields.py"))
    # build minimal input JSON
    inp = {"folder_id": 0, "step": "parse_fields", "results": [{"document_id": "tmp", "data": {"raw_text": raw_text}}]}
    result = subprocess.run(
        [sys.executable, script, "--json", json.dumps(inp)],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Parse CLI failed: {result.stderr}")


def main():
    parser = argparse.ArgumentParser(description="Run field parsing on training documents.")
    parser.add_argument(
        "--dir", default="training",
        help="Root of training tree (default: training)"
    )
    parser.add_argument(
        "--ocr-report", help="Existing OCR report to reuse instead of re-running OCR."
    )
    parser.add_argument(
        "--output", default="training_parse.json",
        help="Where to write the combined report."
    )
    parser.add_argument(
        "--use-cli", action="store_true",
        help="Avoid any direct imports and always call the CLI scripts."
    )
    parser.add_argument(
        "--ocr-engine",
        choices=["tesseract", "chandra", "both"],
        default=None,
        help="Forwarded to ocr_extract when OCR runs (overrides OCR_ENGINE).",
    )
    parser.add_argument(
        "--ocr-primary",
        choices=["tesseract", "chandra"],
        default=None,
        help="Forwarded to ocr_extract when engine is both (overrides OCR_PRIMARY).",
    )
    args = parser.parse_args()
    ocr_kw = {}
    if args.ocr_engine:
        ocr_kw["ocr_engine"] = args.ocr_engine
    if args.ocr_primary:
        ocr_kw["ocr_primary"] = args.ocr_primary

    # if an OCR report is given, load it; otherwise we'll produce per-file OCR on demand
    ocr_data = {}
    if args.ocr_report:
        with open(args.ocr_report, 'r', encoding='utf-8') as f:
            ocr_entry = json.load(f)
        # create a mapping from filepath->raw_text using the 'file' key or document_id
        for r in ocr_entry.get('results', []):
            key = r.get('file') or r.get('document_id')
            text = r.get('data', {}).get('raw_text', '')
            if key:
                ocr_data[key] = text

    files = list(collect_files(args.dir))
    if not files:
        print("no documents found under", args.dir)
        sys.exit(1)

    print(f"found {len(files)} candidate documents, running parse step...")
    overall = []

    for idx, path in enumerate(files, start=1):
        print(f"[{idx}/{len(files)}] {path}")

        # obtain raw text either from OCR report or by running OCR
        if path in ocr_data:
            raw = ocr_data[path]
        else:
            # run OCR
            if args.use_cli or not _OCR_DIRECT:
                ocr_out = run_ocr_cli(
                    path,
                    ocr_engine=args.ocr_engine,
                    ocr_primary=args.ocr_primary,
                )
                raw = ocr_out.get('results', [{}])[0].get('data', {}).get('raw_text', '')
            else:
                ocr_res = ocr_extract.process_document(
                    {"document_id": path, "file_path": path},
                    folder_id=None,
                    **ocr_kw,
                )
                raw = ocr_res.get('data', {}).get('raw_text', '')

        # run parser
        if args.use_cli or not _PARSE_DIRECT:
            parse_out = run_parse_cli(raw)
            res = parse_out.get('results', [])[0] if parse_out else {"error": "no output"}
            overall.append({"file": path, **res})
        else:
            parse_res = parse_fields.process_document({"document_id": path, "raw_text": raw}, folder_id=None)
            overall.append({"file": path, **parse_res})

    report = {"success": True, "count": len(overall), "results": overall}
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"parse step completed; report written to {args.output}")


if __name__ == "__main__":
    main()
