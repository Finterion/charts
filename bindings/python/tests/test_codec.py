"""Tests for the base64url codec — must round-trip through both directions."""

from __future__ import annotations

import json

import pytest

from finterion_charts import decode_spec, encode_spec


def test_roundtrip_simple():
    spec = {
        "version": 1,
        "panels": [{"id": "p", "kind": "price", "weight": 1}],
    }
    enc = encode_spec(spec)
    assert "=" not in enc
    assert "+" not in enc and "/" not in enc
    assert decode_spec(enc) == spec


def test_roundtrip_with_unicode_label():
    spec = {
        "version": 1,
        "panels": [
            {"id": "p", "kind": "price", "weight": 1, "title": "AAPL · €/$"}
        ],
    }
    enc = encode_spec(spec)
    assert decode_spec(enc) == spec


def test_decode_handles_padded_input():
    spec = {"version": 1, "panels": [{"id": "p", "kind": "price", "weight": 1}]}
    enc = encode_spec(spec)
    # Add explicit padding back; decoder should still accept it.
    pad = "=" * ((-len(enc)) % 4)
    assert decode_spec(enc + pad) == spec


def test_encoder_uses_compact_json():
    """Compact ',:'/'":"' separators — the same shape as JS JSON.stringify."""
    spec = {"version": 1, "panels": [{"id": "p", "kind": "price", "weight": 1}]}
    enc = encode_spec(spec)
    import base64

    pad = "=" * ((-len(enc)) % 4)
    raw = base64.urlsafe_b64decode(enc + pad).decode("utf-8")
    # No spaces between key and value or between members.
    assert ", " not in raw
    assert ": " not in raw
    assert raw == json.dumps(spec, separators=(",", ":"), ensure_ascii=False)


def test_encoder_rejects_nan():
    with pytest.raises(ValueError):
        encode_spec({"version": 1, "panels": [], "x": float("nan")})
