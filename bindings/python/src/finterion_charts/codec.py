"""URL-safe base64 codec for ChartSpec.

Mirrors `encodeSpec` / `decodeSpec` in `packages/spec/src/index.ts`. Output is
base64url with no padding, matching the ``#spec=…`` fragment used by the embed
iframe.

The TS version does ``btoa(unescape(encodeURIComponent(JSON.stringify(spec))))``
which is just "UTF-8 bytes → base64". We do the obvious Python equivalent with
:mod:`json` (compact separators) and :func:`base64.urlsafe_b64encode`.
"""

from __future__ import annotations

import base64
import json
from typing import Any


def _serialize(spec: Any) -> bytes:
    """Compact, JSON.stringify-compatible UTF-8 bytes."""
    # JSON.stringify defaults: ',' / ':' separators, no ASCII escaping.
    return json.dumps(
        spec,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def encode_spec(spec: Any) -> str:
    """Encode a ChartSpec dict to a URL-safe base64 string (no padding)."""
    return base64.urlsafe_b64encode(_serialize(spec)).rstrip(b"=").decode("ascii")


def decode_spec(encoded: str) -> dict[str, Any]:
    """Decode a base64url-encoded ChartSpec back to a dict."""
    pad = (-len(encoded)) % 4
    raw = base64.urlsafe_b64decode(encoded + ("=" * pad))
    obj = json.loads(raw.decode("utf-8"))
    if not isinstance(obj, dict):
        raise ValueError("decoded payload is not a ChartSpec object")
    return obj
