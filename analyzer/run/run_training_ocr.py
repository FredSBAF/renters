#!/usr/bin/env python3
"""Exercise OCR extraction on training documents.

This companion to ``run_training_classification.py`` walks the same directory tree
and feeds each file through ``ocr_extract.py``.  Results are aggregated in a
single JSON report which can be inspected for confidence scores, extracted
text snippets, warning flags, etc.

Usage example:
    python analyzer/run/run_training_ocr.py --dir training --output /tmp/ocr.json
    python analyzer/run/run_training_ocr.py --use-cli              # force CLI path

The script will try to import ``ocr_extract`` from the parent directory; if
that fails it falls back to invoking the CLI script via subprocess.

# Help text
python3 analyzer/run/run_training_ocr.py --help

# default behaviour
python3 analyzer/run/run_training_ocr.py --output analyzer/run/results.json



# force CLI path (useful if running from a different cwd)
python3 analyzer/run/run_training_ocr.py --use-cli


"""

import argparse
import json
import os
import sys
import subprocess

# attempt to import the module for direct calls
try:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if root not in sys.path:
        sys.path.insert(0, root)
    import ocr_extract
    _DIRECT_IMPORT = True
except Exception:  # pragma: no cover
    _DIRECT_IMPORT = False


def collect_files(root_dir):
    exts = (".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp")
    for dirpath, _, filenames in os.walk(root_dir):
        for fn in filenames:
            if fn.lower().endswith(exts):
                yield os.path.join(dirpath, fn)


def main():
    parser = argparse.ArgumentParser(description="Run OCR on training documents.")
    parser.add_argument(
        "--dir", default="training",
        help="Root of training tree (default: training)"
    )
    parser.add_argument(
        "--output", default="training_ocr.json",
        help="Where to write the combined report."
    )
    parser.add_argument(
        "--use-cli", action="store_true",
        help="Always invoke the ocr_extract CLI instead of importing."
    )
    parser.add_argument(
        "--ocr-engine",
        choices=["tesseract", "chandra", "both"],
        default=None,
        help="Passed to ocr_extract (overrides OCR_ENGINE).",
    )
    parser.add_argument(
        "--ocr-primary",
        choices=["tesseract", "chandra"],
        default=None,
        help="When engine is both, primary for raw_text (overrides OCR_PRIMARY).",
    )
    args = parser.parse_args()

    files = list(collect_files(args.dir))
    if not files:
        print("no documents found under", args.dir)
        sys.exit(1)

    print(f"found {len(files)} candidate documents, running OCR...")
    overall = []
    for idx, path in enumerate(files, start=1):
        print(f"[{idx}/{len(files)}] {path}")
        if args.use_cli or not _DIRECT_IMPORT:
            cmd = [
                sys.executable,
                os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "ocr_extract.py")),
                "--file",
                path,
            ]
            if args.ocr_engine:
                cmd.extend(["--ocr-engine", args.ocr_engine])
            if args.ocr_primary:
                cmd.extend(["--ocr-primary", args.ocr_primary])
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )
            try:
                resobj = json.loads(result.stdout)
            except json.JSONDecodeError:
                raise RuntimeError(f"OCR CLI failed for {path}: {result.stderr}")
            res = resobj.get("results", [])[0] if resobj else {"error": "no output"}
            overall.append({"file": path, **res})
        else:
            info = {"document_id": path, "file_path": path}
            kw = {}
            if args.ocr_engine:
                kw["ocr_engine"] = args.ocr_engine
            if args.ocr_primary:
                kw["ocr_primary"] = args.ocr_primary
            res = ocr_extract.process_document(info, folder_id=None, **kw)
            overall.append({"file": path, **res})

    report = {"success": True, "count": len(overall), "results": overall}
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"OCR completed; report written to {args.output}")


if __name__ == "__main__":
    main()
