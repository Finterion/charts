"""Capability discovery — for LLM prompts and runtime introspection.

Mirrors `getChartCapabilities` from `packages/spec/src/index.ts`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ChartCapabilities:
    version: int
    panel_kinds: tuple[str, ...]
    indicator_kinds: tuple[str, ...]
    series_types: tuple[str, ...]
    format_directives: tuple[str, ...]
    themes: tuple[str, ...]
    grid_styles: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        """Match the TS-side JSON shape (camelCase keys, list values)."""
        return {
            "version": self.version,
            "panelKinds": list(self.panel_kinds),
            "indicatorKinds": list(self.indicator_kinds),
            "seriesTypes": list(self.series_types),
            "formatDirectives": list(self.format_directives),
            "themes": list(self.themes),
            "gridStyles": list(self.grid_styles),
        }


_CAPABILITIES = ChartCapabilities(
    version=1,
    panel_kinds=("price", "indicator", "heatmap", "hbar", "histogram", "scatter"),
    indicator_kinds=("line", "histogram", "area", "band"),
    series_types=("candles", "line", "area"),
    format_directives=(
        "pct0",
        "pct1",
        "pct2",
        "fixed0",
        "fixed1",
        "fixed2",
        "short-num",
        "iso-date",
    ),
    themes=(
        "tradingview-light",
        "tradingview-dark",
        "terminal-light",
        "terminal-dark",
        "finterion-light",
        "finterion-dark",
    ),
    grid_styles=("none", "horizontal", "full"),
)


def get_chart_capabilities() -> ChartCapabilities:
    return _CAPABILITIES


__all__ = ["ChartCapabilities", "get_chart_capabilities"]
