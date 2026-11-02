"""Reusable multi-chart dashboard specification."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Literal

from .builder import ChartSpec
from .validator import validate_spec


class ChartCanvas:
    def __init__(
        self,
        title: str,
        charts: Mapping[str, ChartSpec | dict[str, Any]],
        *,
        layout: Literal["single", "grid"] = "single",
        columns: int = 2,
        chart_height: int = 720,
        selector: Mapping[str, str] | None = None,
        selected: Sequence[str] | None = None,
        layout_toggle: bool = True,
    ) -> None:
        self.title = title
        self.charts = dict(charts)
        self.layout = layout
        self.columns = columns
        self.chart_height = chart_height
        self.selector = dict(selector) if selector is not None else {"type": "tabs", "label": "Chart"}
        self.selected = list(selected) if selected is not None else None
        self.layout_toggle = layout_toggle
        self.to_dict()

    def to_dict(self) -> dict[str, Any]:
        if not isinstance(self.title, str) or not self.title.strip():
            raise ValueError("Canvas title must not be empty")
        if self.layout not in ("single", "grid"):
            raise ValueError("Canvas layout must be 'single' or 'grid'")
        for name, value in (("columns", self.columns), ("chart_height", self.chart_height)):
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                raise ValueError(f"{name} must be a positive integer")
        if not isinstance(self.layout_toggle, bool):
            raise ValueError("layout_toggle must be boolean")
        if (
            self.selector.get("type") not in ("dropdown", "tabs", "multiselect", "checkboxes")
            or set(self.selector) - {"type", "label"}
            or "label" in self.selector and not isinstance(self.selector["label"], str)
        ):
            raise ValueError("Invalid canvas selector")
        if not self.charts:
            raise ValueError("Canvas requires at least one chart")
        charts = {}
        for chart_id, chart in self.charts.items():
            if not isinstance(chart_id, str) or not chart_id.strip():
                raise ValueError("Chart IDs must be non-empty strings")
            if not isinstance(chart, (ChartSpec, dict)):
                raise TypeError(f"Chart {chart_id!r} must be a ChartSpec or dict")
            data = chart.to_dict() if isinstance(chart, ChartSpec) else chart
            validate_spec(data).raise_if_invalid()
            charts[chart_id] = data
        result: dict[str, Any] = {
            "version": 1, "kind": "canvas", "title": self.title, "charts": charts,
            "layout": self.layout, "columns": self.columns,
            "chartHeight": self.chart_height, "selector": dict(self.selector),
            "layoutToggle": self.layout_toggle,
        }
        if self.selected is not None:
            if (
                any(not isinstance(key, str) or key not in charts for key in self.selected)
                or len(set(self.selected)) != len(self.selected)
            ):
                raise ValueError("selected must contain unique existing chart IDs")
            result["selected"] = list(self.selected)
        return result

    def display_in_jupyter(
        self, *, width: int | str = "100%", height: int | str = 800,
        base: str | None = None, mode: Literal["inline", "url", "auto"] = "auto",
    ) -> Any:
        from .display import display_spec

        return display_spec(self.to_dict(), width=width, height=height, base=base, mode=mode)

    def _repr_html_(self) -> str:
        return self.display_in_jupyter()._repr_html_()
