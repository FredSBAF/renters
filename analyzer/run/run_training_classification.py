#!/usr/bin/env python3
"""Run classify_document.py against every file found in the training directory.

This helper is intended for developers who want to sanity‑check the behaviour of
`classify_document` on the sample documents kept under `training/`.  It walks the
training tree, collects all candidate files (pdf/images) and either:

  * imports and calls the classification routine directly, or
  * delegates to the CLI using a subprocess (fallback).

By default the script prints a summary to stdout and writes a JSON report to disk.

Usage:
    python run_training_classification.py [--dir TRAINING_DIR] [--output FILE]

See also the `pouraccord_pipeline_analyse.md` documentation for details of the
input/output JSON format.


# help text
python3 analyzer/run/run_training_classification.py --help

# classify everything under training/, write report locally
python3 analyzer/run/run_training_classification.py

#classique
python3 analyzer/run/run_training_classification.py --output analyzer/run/results.json

# specify a different training folder or output file
python3 analyzer/run/run_training_classification.py  --dir "training/documents locataires" --output /tmp/train-results.json

# force the CLI path (slower)
python3 analyzer/run/run_training_classification.py --use-cli
"""

import argparse
import json
import os
import sys
import subprocess

# try to import the library so we can call process_document directly
try:
    # script now lives in analyzer/run; the core module lives one level up
    analyzer_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if analyzer_root not in sys.path:
        sys.path.insert(0, analyzer_root)
    import classify_document
    _DIRECT_IMPORT = True
except Exception:  # pragma: no cover - fallback to subprocess
    _DIRECT_IMPORT = False


def collect_files(root_dir):
    """Recursively collect document paths under ``root_dir``.

    Only files with recognised extensions are returned.
    """
    exts = (".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp")
    for dirpath, _, filenames in os.walk(root_dir):
        for fn in filenames:
            if fn.lower().endswith(exts):
                yield os.path.join(dirpath, fn)


def classify_with_subprocess(path):
    """Call ``classify_document.py --file`` via subprocess and return parsed JSON."""
    # locate the script relative to this file (one directory up)
    script = os.path.join(os.path.dirname(__file__), "..", "classify_document.py")
    script = os.path.normpath(script)
    result = subprocess.run(
        [sys.executable, script, "--file", path],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"classification CLI failed for {path}: {result.stderr}")


def main():
    parser = argparse.ArgumentParser(description="Classify training documents.")
    parser.add_argument(
        "--dir",
        default="training",
        help="Path to the root of the training directory. (default: training)",
    )
    parser.add_argument(
        "--output",
        default="training_classification.json",
        help="File where the complete report will be written.",
    )
    parser.add_argument(
        "--use-cli",
        action="store_true",
        help="Always invoke the classify_document CLI instead of importing.",
    )

    args = parser.parse_args()

    files = list(collect_files(args.dir))
    if not files:
        print("no documents found under", args.dir)
        sys.exit(1)

    print(f"found {len(files)} candidate documents, running classification...")

    overall_results = []
    for idx, path in enumerate(files, start=1):
        print(f"[{idx}/{len(files)}] {path}")
        if args.use_cli or not _DIRECT_IMPORT:
            output = classify_with_subprocess(path)
            # CLI returns a full output object; take the first result entry
            res = output.get("results", [])[0] if output else {"error": "no output"}
            overall_results.append({"file": path, **res})
        else:
            doc_info = {"document_id": path, "file_path": path}
            res = classify_document.process_document(doc_info, folder_id=None)
            overall_results.append({"file": path, **res})

    report = {
        "success": True,
        "count": len(overall_results),
        "results": overall_results,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"classification completed; report written to {args.output}")


if __name__ == "__main__":
    main()
