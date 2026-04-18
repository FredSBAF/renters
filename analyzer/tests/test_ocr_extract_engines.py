"""Tests for OCR engine routing (Tesseract / Chandra / compare)."""

from __future__ import annotations

import os
import sys
from unittest.mock import patch

# analyzer package root
_ANALYZER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ANALYZER_ROOT not in sys.path:
    sys.path.insert(0, _ANALYZER_ROOT)

import ocr_extract  # noqa: E402


_TESS_OK = {
    "success": True,
    "raw_text": "tesseract_text",
    "confidence_score": 0.88,
    "page_count": 2,
    "warnings": [],
    "fallback_triggered": False,
    "error": None,
}

_CH_OK = {
    "success": True,
    "raw_text": "chandra_markdown",
    "confidence_score": None,
    "page_count": 2,
    "chandra_method": "vllm",
    "warnings": ["CHANDRA_NO_CONFIDENCE_SCORE"],
    "error": None,
}


@patch("ocr_chandra.run_chandra_document", return_value=_CH_OK)
@patch.object(ocr_extract, "_extract_tesseract", return_value=_TESS_OK.copy())
def test_both_engines_compare_and_primary_tesseract(mock_tess, mock_chandra):
    r = ocr_extract.process_document(
        {"document_id": "d1", "file_path": "/fake/doc.pdf"},
        None,
        ocr_engine="both",
        ocr_primary="tesseract",
    )
    assert r["success"] is True
    d = r["data"]
    assert d["engine_used"] == "both"
    assert d["raw_text"] == "tesseract_text"
    assert d["confidence_score"] == 0.88
    assert d["compare"]["tesseract"]["success"] is True
    assert d["compare"]["chandra"]["raw_text"] == "chandra_markdown"
    assert "PRIMARY_OCR_FAILED_FALLBACK" not in r["warnings"]


@patch("ocr_chandra.run_chandra_document", return_value=_CH_OK.copy())
@patch.object(ocr_extract, "_extract_tesseract", return_value=_TESS_OK.copy())
def test_both_primary_chandra(mock_tess, mock_chandra):
    r = ocr_extract.process_document(
        {"document_id": "d1", "file_path": "/fake/doc.pdf"},
        None,
        ocr_engine="both",
        ocr_primary="chandra",
    )
    assert r["success"] is True
    assert r["data"]["raw_text"] == "chandra_markdown"
    assert r["data"]["confidence_score"] is None


@patch("ocr_chandra.run_chandra_document")
@patch.object(ocr_extract, "_extract_tesseract")
def test_both_chandra_fails_fallback_tesseract(mock_tess, mock_chandra):
    mock_tess.return_value = _TESS_OK.copy()
    mock_chandra.return_value = {
        "success": False,
        "raw_text": "",
        "page_count": 0,
        "confidence_score": None,
        "chandra_method": "vllm",
        "warnings": [],
        "error": {"code": "CHANDRA_FAILED", "message": "boom"},
    }
    r = ocr_extract.process_document(
        {"document_id": "d1", "file_path": "/fake/doc.pdf"},
        None,
        ocr_engine="both",
        ocr_primary="chandra",
    )
    assert r["success"] is True
    assert r["data"]["raw_text"] == "tesseract_text"
    assert "PRIMARY_OCR_FAILED_FALLBACK" in r["warnings"]


@patch("ocr_chandra.run_chandra_document")
@patch.object(ocr_extract, "_extract_tesseract")
def test_both_all_fail(mock_tess, mock_chandra):
    mock_tess.return_value = {
        "success": False,
        "raw_text": "",
        "confidence_score": 0.0,
        "page_count": 0,
        "warnings": [],
        "fallback_triggered": False,
        "error": {"code": "OCR_FAILED", "message": "tess bad"},
    }
    mock_chandra.return_value = {
        "success": False,
        "raw_text": "",
        "page_count": 0,
        "confidence_score": None,
        "chandra_method": "vllm",
        "warnings": [],
        "error": {"code": "CHANDRA_FAILED", "message": "ch bad"},
    }
    r = ocr_extract.process_document(
        {"document_id": "d1", "file_path": "/fake/doc.pdf"},
        None,
        ocr_engine="both",
    )
    assert r["success"] is False
    assert r["error"]["code"] == "OCR_ALL_ENGINES_FAILED"


@patch.object(ocr_extract, "_extract_tesseract", return_value=_TESS_OK.copy())
def test_tesseract_only(mock_tess):
    r = ocr_extract.process_document(
        {"document_id": 'd1', "file_path": "/fake/doc.pdf"},
        None,
        ocr_engine="tesseract",
    )
    assert r["success"] is True
    assert r["data"]["engine_used"] == "tesseract"
    assert "compare" not in r["data"]


@patch("ocr_chandra.run_chandra_document", return_value=_CH_OK.copy())
def test_chandra_only(mock_chandra):
    r = ocr_extract.process_document(
        {"document_id": "d1", "file_path": "/fake/doc.pdf"},
        None,
        ocr_engine="chandra",
    )
    assert r["success"] is True
    assert r["data"]["engine_used"] == "chandra_vllm"


@patch.dict(os.environ, {"OCR_ENGINE": "both", "OCR_PRIMARY": "chandra"}, clear=False)
@patch("ocr_chandra.run_chandra_document", return_value=_CH_OK.copy())
@patch.object(ocr_extract, "_extract_tesseract", return_value=_TESS_OK.copy())
def test_env_overrides_when_kwargs_absent(mock_tess, mock_chandra):
    r = ocr_extract.process_document(
        {"document_id": "d1", "file_path": "/fake/doc.pdf"},
        None,
    )
    assert r["success"] is True
    assert r["data"]["engine_used"] == "both"
    assert r["data"]["raw_text"] == "chandra_markdown"
