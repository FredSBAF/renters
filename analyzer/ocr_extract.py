import os
import sys
import json
import argparse
import logging
import tempfile
import requests
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image, ImageEnhance
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def preprocess_image(image):
    """
    Apply image preprocessing to improve OCR accuracy.
    Same logic as in classify_document.py to ensure consistency.
    """
    try:
        processed_img = image.convert("L")

        enhancer = ImageEnhance.Contrast(processed_img)
        processed_img = enhancer.enhance(2.0)

        enhancer = ImageEnhance.Sharpness(processed_img)
        processed_img = enhancer.enhance(1.5)

        width, height = processed_img.size
        target_width = 2500
        if width < target_width:
            ratio = target_width / width
            new_size = (int(width * ratio), int(height * ratio))
            processed_img = processed_img.resize(new_size, Image.Resampling.LANCZOS)

        return processed_img
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}")
        return image


def run_ocr_on_image(image):
    """
    Run Tesseract OCR on a single image and return text + average confidence.
    """
    try:
        processed_image = preprocess_image(image)

        data = pytesseract.image_to_data(
            processed_image, lang="fra+eng", output_type=pytesseract.Output.DICT
        )

        text_parts = []
        confidences = []

        n_boxes = len(data["text"])
        for i in range(n_boxes):
            conf = int(data["conf"][i])
            text = data["text"][i].strip()

            if conf > -1 and text:
                text_parts.append(text)
                confidences.append(conf)

        full_text = " ".join(text_parts)

        avg_confidence = 0.0
        if confidences:
            avg_confidence = sum(confidences) / len(confidences) / 100.0

        return full_text, avg_confidence

    except Exception as e:
        logger.error(f"OCR execution failed: {e}")
        return "", 0.0


def load_document_images(file_path_or_url):
    """
    Load a document and return a list of PIL Images (one per page).
    """
    try:
        is_url = urlparse(file_path_or_url).scheme in ("http", "https")

        if is_url:
            response = requests.get(file_path_or_url, timeout=10)
            response.raise_for_status()
            content = response.content
            filename = os.path.basename(urlparse(file_path_or_url).path)
        else:
            if not os.path.exists(file_path_or_url):
                raise FileNotFoundError(f"File not found: {file_path_or_url}")
            with open(file_path_or_url, "rb") as f:
                content = f.read()
            filename = os.path.basename(file_path_or_url)

        lower_filename = filename.lower()

        if lower_filename.endswith(".pdf"):
            images = convert_from_bytes(content, dpi=300)
            if not images:
                raise ValueError("PDF content is empty or could not be converted")
            return images

        if lower_filename.endswith((".jpg", ".jpeg", ".png", ".tiff", ".bmp")):
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=os.path.splitext(filename)[1]
            ) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                img = Image.open(tmp_path)
                img.load()
                return [img]
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        raise ValueError(f"Unsupported file format: {filename}")

    except Exception as e:
        logger.error(f"Error loading document images: {e}")
        raise


def _normalize_engine(value: str | None) -> str:
    s = (value or os.environ.get("OCR_ENGINE") or "tesseract").lower()
    if s not in ("tesseract", "chandra", "both"):
        logger.warning("Invalid OCR_ENGINE %r, using tesseract", s)
        return "tesseract"
    return s


def _normalize_primary(value: str | None) -> str:
    s = (value or os.environ.get("OCR_PRIMARY") or "tesseract").lower()
    if s not in ("tesseract", "chandra"):
        logger.warning("Invalid OCR_PRIMARY %r, using tesseract", s)
        return "tesseract"
    return s


def _extract_tesseract(file_path: str, doc_id: str) -> dict:
    """Run Tesseract on all pages. Returns uniform dict for merging / compare."""
    try:
        images = load_document_images(file_path)
        page_count = len(images)
        logger.info(f"Document {doc_id} has {page_count} pages (Tesseract).")

        full_text_parts = []
        page_confidences = []

        for i, img in enumerate(images):
            logger.info(f"Tesseract page {i + 1}/{page_count}...")
            text, conf = run_ocr_on_image(img)
            full_text_parts.append(text)
            page_confidences.append(conf)

        full_text = "\n\n".join(full_text_parts)

        global_confidence = 0.0
        if page_confidences:
            global_confidence = sum(page_confidences) / len(page_confidences)

        warnings = []
        if global_confidence < 0.50:
            warnings.append("LOW_CONFIDENCE_OCR")

        return {
            "success": True,
            "raw_text": full_text,
            "confidence_score": round(global_confidence, 2),
            "page_count": page_count,
            "warnings": warnings,
            "fallback_triggered": False,
            "error": None,
        }
    except Exception as e:
        logger.error("Tesseract error on document %s: %s", doc_id, e)
        return {
            "success": False,
            "raw_text": "",
            "confidence_score": 0.0,
            "page_count": 0,
            "warnings": [],
            "fallback_triggered": False,
            "error": {"code": "OCR_FAILED", "message": str(e)},
        }


def _leaf_tesseract(t: dict) -> dict:
    if not t.get("success"):
        return {
            "success": False,
            "raw_text": t.get("raw_text", ""),
            "confidence_score": t.get("confidence_score"),
            "page_count": t.get("page_count", 0),
            "error": t.get("error"),
        }
    return {
        "success": True,
        "raw_text": t["raw_text"],
        "confidence_score": t["confidence_score"],
        "page_count": t["page_count"],
    }


def _leaf_chandra(c: dict) -> dict:
    if not c.get("success"):
        return {
            "success": False,
            "raw_text": c.get("raw_text", ""),
            "confidence_score": c.get("confidence_score"),
            "page_count": c.get("page_count", 0),
            "chandra_method": c.get("chandra_method"),
            "error": c.get("error"),
        }
    leaf: dict = {
        "success": True,
        "raw_text": c["raw_text"],
        "confidence_score": c.get("confidence_score"),
        "page_count": c["page_count"],
        "chandra_method": c.get("chandra_method"),
    }
    return leaf


def _pick_primary_output(
    primary: str, tess: dict, chandra: dict
) -> tuple[str, float | None, int, list[str]]:
    """Choose raw_text, confidence, page_count for data.raw_text; append warnings."""
    t_ok = bool(tess.get("success"))
    c_ok = bool(chandra.get("success"))
    extra: list[str] = []

    if primary == "tesseract":
        if t_ok:
            return (
                tess["raw_text"],
                tess.get("confidence_score"),
                int(tess.get("page_count", 0)),
                extra,
            )
        if c_ok:
            extra.append("PRIMARY_OCR_FAILED_FALLBACK")
            return (
                chandra["raw_text"],
                chandra.get("confidence_score"),
                int(chandra.get("page_count", 0)),
                extra,
            )
        extra.append("TESSERACT_AND_CHANDRA_FAILED")
        return "", None, 0, extra

    if c_ok:
        return (
            chandra["raw_text"],
            chandra.get("confidence_score"),
            int(chandra.get("page_count", 0)),
            extra,
        )
    if t_ok:
        extra.append("PRIMARY_OCR_FAILED_FALLBACK")
        return (
            tess["raw_text"],
            tess.get("confidence_score"),
            int(tess.get("page_count", 0)),
            extra,
        )
    extra.append("TESSERACT_AND_CHANDRA_FAILED")
    return "", None, 0, extra


def process_document(
    doc_info,
    folder_id,
    ocr_engine: str | None = None,
    ocr_primary: str | None = None,
):
    """
    Process a single document: OCR with Tesseract, Chandra, or both (compare).

    ocr_engine: tesseract | chandra | both (overrides env OCR_ENGINE)
    ocr_primary: tesseract | chandra when engine is both (overrides env OCR_PRIMARY)
    """
    doc_id = doc_info.get("document_id", "unknown")
    file_path = doc_info.get("file_url") or doc_info.get("file_path")

    if not file_path:
        return {
            "document_id": doc_id,
            "success": False,
            "error": {
                "code": "FILE_PATH_MISSING",
                "message": "No file path or URL provided",
                "recoverable": False,
            },
        }

    engine = _normalize_engine(ocr_engine)
    primary = _normalize_primary(ocr_primary)

    logger.info(f"Extracting text from document {doc_id} (engine={engine})")

    if engine == "tesseract":
        t = _extract_tesseract(file_path, doc_id)
        if not t["success"]:
            return {
                "document_id": doc_id,
                "success": False,
                "error": t.get("error")
                or {"code": "OCR_FAILED", "message": "Tesseract failed"},
            }
        return {
            "document_id": doc_id,
            "success": True,
            "data": {
                "raw_text": t["raw_text"],
                "confidence_score": t["confidence_score"],
                "page_count": t["page_count"],
                "engine_used": "tesseract",
                "language_detected": "fr",
            },
            "warnings": t["warnings"],
            "fallback_triggered": t["fallback_triggered"],
        }

    if engine == "chandra":
        from ocr_chandra import run_chandra_document

        c = run_chandra_document(file_path)
        if not c["success"]:
            return {
                "document_id": doc_id,
                "success": False,
                "error": c.get("error")
                or {"code": "CHANDRA_FAILED", "message": "Chandra failed"},
            }
        method = c.get("chandra_method", "vllm")
        return {
            "document_id": doc_id,
            "success": True,
            "data": {
                "raw_text": c["raw_text"],
                "confidence_score": c.get("confidence_score"),
                "page_count": c["page_count"],
                "engine_used": f"chandra_{method}",
            },
            "warnings": c.get("warnings", []),
            "fallback_triggered": False,
        }

    # both
    from ocr_chandra import run_chandra_document

    tess = _extract_tesseract(file_path, doc_id)
    ch = run_chandra_document(file_path)

    t_ok = bool(tess.get("success"))
    c_ok = bool(ch.get("success"))

    if not t_ok and not c_ok:
        return {
            "document_id": doc_id,
            "success": False,
            "error": {
                "code": "OCR_ALL_ENGINES_FAILED",
                "message": "Tesseract and Chandra both failed",
                "details": {
                    "tesseract": tess.get("error"),
                    "chandra": ch.get("error"),
                },
            },
        }

    raw_text, conf, page_count, primary_warnings = _pick_primary_output(
        primary, tess, ch
    )

    warnings = list(tess.get("warnings") or []) + list(ch.get("warnings") or [])
    warnings.extend(primary_warnings)

    data = {
        "raw_text": raw_text,
        "confidence_score": conf,
        "page_count": page_count,
        "engine_used": "both",
        "compare": {
            "tesseract": _leaf_tesseract(tess),
            "chandra": _leaf_chandra(ch),
        },
    }
    raw_from_tesseract = (primary == "tesseract" and t_ok) or (
        primary == "chandra" and (not c_ok) and t_ok
    )
    if raw_from_tesseract:
        data["language_detected"] = "fr"

    return {
        "document_id": doc_id,
        "success": True,
        "data": data,
        "warnings": warnings,
        "fallback_triggered": bool(tess.get("fallback_triggered")),
    }


def main():
    parser = argparse.ArgumentParser(description="Extract text from documents using OCR.")
    parser.add_argument("--file", help="Path to a local file to extract.")
    parser.add_argument("--json", help="JSON string with input data (N8N format).")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin.")
    parser.add_argument(
        "--ocr-engine",
        dest="ocr_engine",
        choices=["tesseract", "chandra", "both"],
        default=None,
        help="OCR backend(s): tesseract (default), chandra, or both for comparison.",
    )
    parser.add_argument(
        "--ocr-primary",
        dest="ocr_primary",
        choices=["tesseract", "chandra"],
        default=None,
        help="When --ocr-engine=both, sets which engine fills data.raw_text (default: tesseract).",
    )

    args = parser.parse_args()

    input_data = {}

    if args.file:
        input_data = {
            "folder_id": 0,
            "step": "ocr_extract",
            "documents": [
                {
                    "document_id": "local_test",
                    "file_path": args.file,
                }
            ],
        }
    elif args.json:
        input_data = json.loads(args.json)
    elif args.stdin:
        input_data = json.load(sys.stdin)
    else:
        if not sys.stdin.isatty():
            try:
                input_data = json.load(sys.stdin)
            except json.JSONDecodeError:
                logger.error("Invalid JSON from stdin")
                sys.exit(1)
        else:
            parser.print_help()
            sys.exit(1)

    folder_id = input_data.get("folder_id")
    documents = input_data.get("documents", [])

    if not documents and ("file_url" in input_data or "file_path" in input_data):
        documents = [input_data]

    results = []
    kw = {}
    if args.ocr_engine:
        kw["ocr_engine"] = args.ocr_engine
    if args.ocr_primary:
        kw["ocr_primary"] = args.ocr_primary

    for doc in documents:
        result = process_document(doc, folder_id, **kw)
        results.append(result)

    output = {
        "success": True,
        "step": "ocr_extract",
        "folder_id": folder_id,
        "results": results,
        "error": None,
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
