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
from math import isfinite
from typing import Any

from .schema import CHART_SPEC_SCHEMA

_PANEL_KINDS = ("price", "indicator", "heatmap", "hbar", "vbar", "histogram", "scatter")


def _decision_errors(value: Any, schema: dict[str, Any], path: str) -> list[str]:
    """Dependency-free checks for the small JSON-only decision schema."""
    types = schema.get("type", [])
    types = [types] if isinstance(types, str) else types
    checks = {
        "object": lambda v: isinstance(v, dict),
        "array": lambda v: isinstance(v, list),
        "string": lambda v: isinstance(v, str),
        "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and isfinite(v),
        "boolean": lambda v: isinstance(v, bool),
        "null": lambda v: v is None,
    }
    if types and not any(checks[t](value) for t in types):
        return [f"{path} has an invalid type"]
    if "enum" in schema and value not in schema["enum"]:
        return [f"{path} is invalid"]
    if isinstance(value, str) and len(value) < schema.get("minLength", 0):
        return [f"{path} must not be empty"]
    if "minimum" in schema and isinstance(value, (int, float)) and value < schema["minimum"]:
        return [f"{path} must be >= {schema['minimum']}"]
    if "maximum" in schema and isinstance(value, (int, float)) and value > schema["maximum"]:
        return [f"{path} must be <= {schema['maximum']}"]
    if "multipleOf" in schema and isinstance(value, (int, float)) and value % schema["multipleOf"]:
        return [f"{path} must be a multiple of {schema['multipleOf']}"]
    errors: list[str] = []
    if isinstance(value, dict):
        props = schema.get("properties", {})
        errors.extend(f"{path}.{key} is required" for key in schema.get("required", []) if key not in value)
        for key, item in value.items():
            if key in props:
                errors.extend(_decision_errors(item, props[key], f"{path}.{key}"))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}.{key} is not allowed")
    if isinstance(value, list):
        for i, item in enumerate(value):
            errors.extend(_decision_errors(item, schema["items"], f"{path}[{i}]"))
    return errors


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

    display = spec.get("display")
    if isinstance(display, dict) and "chartMinHeight" in display:
        height = display["chartMinHeight"]
        if (
            not isinstance(height, (int, float)) or isinstance(height, bool)
            or not isfinite(height) or height < 0
        ):
            errors.append("display.chartMinHeight must be a finite non-negative number")

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
        if "collapsible" in p and not isinstance(p["collapsible"], bool):
            errors.append(f"panels[{i}].collapsible must be a boolean")

    has_time_panel = any(
        isinstance(p, dict) and p.get("kind") in ("price", "indicator")
        for p in panels
    )
    data = spec.get("data") or {}
    if has_time_panel and not data.get("bars"):
        errors.append("data.bars is required when a price/indicator panel is present")

    if "markers" in data:
        markers = data["markers"]
        if not isinstance(markers, list):
            errors.append("data.markers must be an array")
        else:
            for i, marker in enumerate(markers):
                if not isinstance(marker, dict):
                    errors.append(f"data.markers[{i}] must be an object")
                    continue
                if "panelId" in marker and not any(
                    isinstance(panel, dict)
                    and panel.get("id") == marker["panelId"]
                    and panel.get("kind") in ("price", "indicator")
                    for panel in panels
                ):
                    errors.append(
                        f"data.markers[{i}].panelId must reference a price/indicator panel"
                    )
                if "shape" in marker and marker["shape"] not in ("arrow", "circle", "plus", "minus"):
                    errors.append(f"data.markers[{i}].shape must be arrow, circle, plus or minus")

    if "decisions" in data:
        decisions = data["decisions"]
        if not isinstance(decisions, list):
            errors.append("data.decisions must be an array")
        else:
            seen_decisions: set[str] = set()
            for i, decision in enumerate(decisions):
                path = f"data.decisions[{i}]"
                errors.extend(_decision_errors(decision, CHART_SPEC_SCHEMA["$defs"]["decision"], path))
                if not isinstance(decision, dict):
                    continue
                did = decision.get("id")
                if isinstance(did, str):
                    if did in seen_decisions:
                        errors.append(f"{path}.id is duplicated")
                    seen_decisions.add(did)
                if not any(
                    isinstance(p, dict) and p.get("id") == decision.get("panelId")
                    and p.get("kind") in ("price", "indicator") for p in panels
                ):
                    errors.append(f"{path}.panelId must reference a price/indicator panel")

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
