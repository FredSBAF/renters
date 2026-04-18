"""
Chandra OCR integration (datalab-to/chandra).

Requires: pip install chandra-ocr
Optional HF weights: pip install chandra-ocr[hf]

Inference: set CHANDRA_METHOD to vllm (default) or hf.
vLLM: start server (e.g. chandra_vllm) and set VLLM_API_BASE if not default.
"""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Callable
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

CHANDRA_SUPPORTED_EXT = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".tiff",
    ".bmp",
}


def chandra_import_error() -> ImportError | None:
    try:
        import chandra  # noqa: F401
    except ImportError as e:
        return e
    return None


def _cleanup_none() -> None:
    return None


def resolve_local_file(
    file_path_or_url: str,
) -> tuple[str, Callable[[], None]]:
    """
    Chandra load_file() needs a filesystem path.
    Returns (path, cleanup) where cleanup() removes temp file if any.
    """
    parsed = urlparse(file_path_or_url)
    is_url = parsed.scheme in ("http", "https")

    if is_url:
        response = requests.get(file_path_or_url, timeout=60)
        response.raise_for_status()
        filename = os.path.basename(parsed.path) or "document"
        suffix = os.path.splitext(filename)[1].lower()
        if suffix not in CHANDRA_SUPPORTED_EXT:
            suffix = ".pdf"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="chandra_")
        os.close(fd)
        with open(tmp_path, "wb") as f:
            f.write(response.content)

        def cleanup() -> None:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

        return tmp_path, cleanup

    if not os.path.isfile(file_path_or_url):
        raise FileNotFoundError(f"File not found: {file_path_or_url}")

    return os.path.abspath(file_path_or_url), _cleanup_none


def run_chandra_document(file_path_or_url: str, method: str | None = None) -> dict:
    """
    Run Chandra on a PDF or image path/URL.

    Returns a dict:
      - success: bool
      - raw_text: str
      - page_count: int
      - confidence_score: None (Chandra does not expose Tesseract-like scores)
      - chandra_method: str
      - warnings: list[str]
      - error: optional { code, message } when success is False
    """
    err = chandra_import_error()
    if err is not None:
        return {
            "success": False,
            "raw_text": "",
            "page_count": 0,
            "confidence_score": None,
            "chandra_method": method or os.environ.get("CHANDRA_METHOD", "vllm"),
            "warnings": [],
            "error": {
                "code": "CHANDRA_NOT_INSTALLED",
                "message": (
                    "Install with: pip install 'chandra-ocr>=0.2.0' "
                    f"(same Python as this script). Underlying error: {err}"
                ),
            },
        }

    from chandra.input import load_file
    from chandra.model import InferenceManager
    from chandra.model.schema import BatchInputItem

    m = (method or os.environ.get("CHANDRA_METHOD", "vllm")).lower()
    if m not in ("vllm", "hf"):
        m = "vllm"
    batch_size = 1 if m == "hf" else 28

    local_path, cleanup = resolve_local_file(file_path_or_url)
    try:
        ext = os.path.splitext(local_path)[1].lower()
        if ext not in CHANDRA_SUPPORTED_EXT:
            return {
                "success": False,
                "raw_text": "",
                "page_count": 0,
                "confidence_score": None,
                "chandra_method": m,
                "warnings": [],
                "error": {
                    "code": "UNSUPPORTED_FORMAT",
                    "message": f"Chandra does not support extension {ext!r}",
                },
            }

        page_cfg = {}
        page_range = os.environ.get("CHANDRA_PAGE_RANGE")
        if page_range:
            page_cfg["page_range"] = page_range

        images = load_file(local_path, page_cfg)
        if not images:
            return {
                "success": False,
                "raw_text": "",
                "page_count": 0,
                "confidence_score": None,
                "chandra_method": m,
                "warnings": ["EMPTY_DOCUMENT"],
                "error": {
                    "code": "EMPTY_DOCUMENT",
                    "message": "No pages loaded from document",
                },
            }

        max_out = os.environ.get("MAX_OUTPUT_TOKENS")
        max_output_tokens = int(max_out) if max_out and max_out.isdigit() else None

        model = InferenceManager(method=m)
        generate_kwargs: dict = {
            "include_images": os.environ.get("CHANDRA_INCLUDE_IMAGES", "1")
            not in ("0", "false", "no"),
            "include_headers_footers": os.environ.get(
                "CHANDRA_INCLUDE_HEADERS_FOOTERS", ""
            ).lower()
            in ("1", "true", "yes"),
        }
        if m == "vllm":
            mw = os.environ.get("CHANDRA_MAX_WORKERS")
            mr = os.environ.get("CHANDRA_MAX_RETRIES")
            if mw and mw.isdigit():
                generate_kwargs["max_workers"] = int(mw)
            if mr and mr.isdigit():
                generate_kwargs["max_retries"] = int(mr)

        all_markdown_parts: list[str] = []
        warnings: list[str] = []
        page_errors: list[str] = []

        for batch_start in range(0, len(images), batch_size):
            batch_end = min(batch_start + batch_size, len(images))
            batch_images = images[batch_start:batch_end]
            batch = [
                BatchInputItem(image=img, prompt_type="ocr_layout")
                for img in batch_images
            ]
            logger.info(
                "Chandra inference pages %s-%s (%s)",
                batch_start + 1,
                batch_end,
                m,
            )
            outputs = model.generate(batch, max_output_tokens=max_output_tokens, **generate_kwargs)
            for out in outputs:
                if out.error:
                    page_errors.append(str(out.error))
                    all_markdown_parts.append("")
                else:
                    all_markdown_parts.append(out.markdown or "")

        full_text = "\n\n".join(all_markdown_parts).strip()
        if page_errors:
            warnings.append("CHANDRA_PAGE_ERRORS")

        if not full_text and page_errors:
            return {
                "success": False,
                "raw_text": "",
                "page_count": len(images),
                "confidence_score": None,
                "chandra_method": m,
                "warnings": warnings,
                "error": {
                    "code": "CHANDRA_INFERENCE_FAILED",
                    "message": "; ".join(page_errors[:3]),
                },
            }

        return {
            "success": True,
            "raw_text": full_text,
            "page_count": len(images),
            "confidence_score": None,
            "chandra_method": m,
            "warnings": warnings + ["CHANDRA_NO_CONFIDENCE_SCORE"],
            "error": None,
        }
    except Exception as e:
        logger.exception("Chandra OCR failed")
        return {
            "success": False,
            "raw_text": "",
            "page_count": 0,
            "confidence_score": None,
            "chandra_method": m,
            "warnings": [],
            "error": {"code": "CHANDRA_FAILED", "message": str(e)},
        }
    finally:
        cleanup()
