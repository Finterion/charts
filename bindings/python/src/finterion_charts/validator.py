"""Validation for ChartSpec.

Two validators are provided:

- :func:`validate_spec` — cheap, dependency-free, mirrors `validateSpec`
  in `packages/spec/src/index.ts`. Runs the same handful of checks the JS
  validator runs (version, panels array, ids unique, kind known, weight > 0,
  bars present when a time-indexed panel exists). Suitable as a fast
  in-process gate.

- :func:`validate_schema` — strict JSON Schema validation against
  ``CHART_SPEC_SCHEMA``. Requires the optional ``jsonschema`` extra. Use this
  in tests or at trust boundaries.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .schema import CHART_SPEC_SCHEMA

_PANEL_KINDS = ("price", "indicator", "heatmap", "hbar", "vbar", "histogram", "scatter")


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)

    def __bool__(self) -> bool:  # convenience: `if validate_spec(s): ...`
        return self.ok

    def raise_if_invalid(self) -> None:
        if not self.ok:
            raise ValueError(
                "Invalid ChartSpec:\n  - " + "\n  - ".join(self.errors)
            )


def validate_spec(spec: Any) -> ValidationResult:
    """Cheap structural validator — mirrors the TS `validateSpec` 1:1."""
    errors: list[str] = []

    if not isinstance(spec, dict):
        return ValidationResult(ok=False, errors=["spec must be an object"])

    version = spec.get("version")
    if version != 1:
        errors.append(f"version must be 1 (got {version!r})")

    panels = spec.get("panels")
    if not isinstance(panels, list):
        errors.append("panels must be an array")
        return ValidationResult(ok=False, errors=errors)

    seen_ids: set[str] = set()
    for i, p in enumerate(panels):
        if not isinstance(p, dict):
            errors.append(f"panels[{i}] must be an object")
            continue
        pid = p.get("id")
        if not isinstance(pid, str) or not pid:
            errors.append(f"panels[{i}].id is required")
        elif pid in seen_ids:
            errors.append(f'panels[{i}].id "{pid}" is duplicated')
        else:
            seen_ids.add(pid)

        kind = p.get("kind")
        if kind not in _PANEL_KINDS:
            errors.append(f'panels[{i}].kind "{kind}" is invalid')

        weight = p.get("weight")
        if not isinstance(weight, (int, float)) or isinstance(weight, bool) or weight <= 0:
            errors.append(f"panels[{i}].weight must be a positive number")

    has_time_panel = any(
        isinstance(p, dict) and p.get("kind") in ("price", "indicator")
        for p in panels
    )
    data = spec.get("data") or {}
    if has_time_panel and not data.get("bars"):
        errors.append("data.bars is required when a price/indicator panel is present")

    return ValidationResult(ok=not errors, errors=errors)


def validate_schema(spec: Any) -> ValidationResult:
    """Strict JSON Schema validation. Requires the ``jsonschema`` extra."""
    try:
        import jsonschema  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "validate_schema requires the 'jsonschema' package. "
            "Install with: pip install 'finterion-charts[schema]'"
        ) from exc

    validator_cls = jsonschema.Draft202012Validator
    validator = validator_cls(CHART_SPEC_SCHEMA)
    errors = [
        f"{'/'.join(str(p) for p in err.absolute_path) or '<root>'}: {err.message}"
        for err in sorted(validator.iter_errors(spec), key=lambda e: list(e.absolute_path))
    ]
    return ValidationResult(ok=not errors, errors=errors)
