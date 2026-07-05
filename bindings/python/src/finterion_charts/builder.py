"""Ergonomic builder for ChartSpec.

The classes here produce plain dicts that match the JSON ``ChartSpec`` shape
emitted by `@finterion/charts-spec`. They never render anything — `to_dict()`
on any of them returns the JSON-safe form, and `ChartSpec.to_dict()` returns
the full top-level spec ready to be serialised.

Numpy arrays and pandas Series are accepted wherever a numeric sequence is
expected; they are coerced to Python ``list[float]`` (with ``NaN`` → ``None``)
on serialisation so the output is always strict JSON.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from math import isfinite, isnan
from typing import Any, Iterable, Literal, Sequence, Union

from .codec import encode_spec
from .schema import SPEC_VERSION
from .validator import validate_spec

# ─────────────────────────────────────────────────────────────────────────────
# Type aliases & string-enums.
#
# We expose each enum-shaped value in two complementary forms:
#   - a `Literal[...]` alias (for static type-checking & accepting raw strings)
#   - a `str, Enum` class (for ergonomic attribute access in user code)
#
# Because the enums subclass `str`, members serialise transparently to JSON
# and compare equal to their plain-string counterparts — so users can mix and
# match freely:
#
#     ChartSpec(theme=Theme.terminal_dark)   # enum (autocomplete)
#     ChartSpec(theme="terminal-dark")        # raw literal
# ─────────────────────────────────────────────────────────────────────────────

ThemeName = Literal[
    "tradingview-light",
    "tradingview-dark",
    "terminal-light",
    "terminal-dark",
    "finterion-light",
    "finterion-dark",
]


class Theme(str, Enum):
    """Built-in theme names. Members are plain strings — usable anywhere a
    `ThemeName` literal is accepted.

    Usage::

        ChartSpec(theme=Theme.terminal_dark)  # type-checked, autocomplete
        ChartSpec(theme="terminal-dark")       # raw literal also fine
    """

    tradingview_light = "tradingview-light"
    tradingview_dark = "tradingview-dark"
    terminal_light = "terminal-light"
    terminal_dark = "terminal-dark"
    finterion_light = "finterion-light"
    finterion_dark = "finterion-dark"

    def __str__(self) -> str:  # ensure f-strings emit the value, not 'Theme.x'
        return self.value


GridStyle = Literal["none", "horizontal", "full"]
#: Series rendering type for `Price` panels.
SeriesTypeName = Literal["candles", "line", "area"]


class SeriesType(str, Enum):
    """Series rendering type for `Price` panels. Members are plain strings.

    Usage::

        Price(id="px", weight=3, type=SeriesType.candles)
        Price(id="px", weight=3, type="candles")  # also fine
    """

    candles = "candles"
    line = "line"
    area = "area"

    def __str__(self) -> str:
        return self.value


IndicatorKind = Literal["line", "histogram", "area", "band"]

#: Stroke style for line-based indicator kinds (`line`, `area`, `band`).
LineStyleName = Literal["solid", "dashed", "dotted"]


class LineStyle(str, Enum):
    """Stroke style for line-based indicator kinds (`line`, `area`, `band`).
    Has no effect on `histogram`. Members are plain strings.

    Usage::

        Indicator.line(values="x", color="#0f0", line_style=LineStyle.dashed)
        Indicator.line(values="x", color="#0f0", line_style="dashed")  # also fine
    """

    solid = "solid"
    dashed = "dashed"
    dotted = "dotted"

    def __str__(self) -> str:
        return self.value


FormatDirective = Literal[
    "pct0", "pct1", "pct2", "fixed0", "fixed1", "fixed2", "short-num", "iso-date"
]
Side = Literal["buy", "sell"]

#: Anything that can be converted to a JSON ``number[]``.
NumericSeq = Union[Sequence[float], Sequence[int], Iterable[float], Any]
#: Either a literal numeric array or a column reference ``{"column": "name"}``.
ValuesRef = Union[NumericSeq, str, dict]


# ─────────────────────────────────────────────────────────────────────────────
# Coercion helpers
# ─────────────────────────────────────────────────────────────────────────────


def _to_jsonable_floats(values: NumericSeq, *, allow_null: bool = True) -> list:
    """Coerce numpy/pandas/list of numerics to a plain JSON-safe list.

    Non-finite values (``NaN`` / ``±inf``) become ``None`` when ``allow_null``
    is set, matching how the engine's compiler treats null entries (gap in line
    renderers). With ``allow_null=False`` they raise — used for OHLC fields
    where gaps are not meaningful.
    """
    # Fast path for numpy arrays
    try:
        import numpy as np  # type: ignore[import-not-found]
    except ImportError:  # pragma: no cover - numpy is optional
        np = None  # type: ignore[assignment]

    if np is not None and isinstance(values, np.ndarray):
        out: list[Any] = []
        for v in values.tolist():
            if v is None or (isinstance(v, float) and not isfinite(v)):
                if not allow_null:
                    raise ValueError("non-finite value not permitted in OHLC arrays")
                out.append(None)
            else:
                out.append(float(v))
        return out

    # Pandas Series / Index
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except ImportError:  # pragma: no cover - pandas is optional
        pd = None  # type: ignore[assignment]

    if pd is not None and isinstance(values, (pd.Series, pd.Index)):
        return _to_jsonable_floats(values.to_numpy(), allow_null=allow_null)

    out = []
    for v in values:  # type: ignore[union-attr]
        if v is None:
            if not allow_null:
                raise ValueError("None value not permitted in OHLC arrays")
            out.append(None)
            continue
        f = float(v)
        if not isfinite(f):
            if not allow_null:
                raise ValueError("non-finite value not permitted in OHLC arrays")
            out.append(None)
        else:
            out.append(f)
    return out


def _to_time_array(values: NumericSeq) -> list[float]:
    """Coerce a time array to ms-epoch floats. Pandas datetimes → ms."""
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except ImportError:  # pragma: no cover
        pd = None  # type: ignore[assignment]

    if pd is not None:
        # `Series.view` was removed in pandas 2.2; reinterpret datetime64
        # arrays as int64 ns via the underlying numpy array instead.
        if isinstance(values, pd.DatetimeIndex):
            ns = values.to_numpy().astype("int64", copy=False)
            return [float(v) for v in ns // 1_000_000]
        if isinstance(values, pd.Series) and pd.api.types.is_datetime64_any_dtype(values):
            ns = values.to_numpy().astype("int64", copy=False)
            return [float(v) for v in ns // 1_000_000]

    coerced = _to_jsonable_floats(values, allow_null=False)
    return [float(v) for v in coerced]  # type: ignore[arg-type]


def _values_ref(v: ValuesRef) -> Any:
    """Normalise a values argument into either ``[..numbers]`` or ``{"column": "..."}``."""
    if isinstance(v, str):
        return {"column": v}
    if isinstance(v, dict):
        if "column" not in v or not isinstance(v["column"], str):
            raise ValueError("column reference must be {'column': '<name>'}")
        return {"column": v["column"]}
    return _to_jsonable_floats(v)


def _drop_none(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


# ─────────────────────────────────────────────────────────────────────────────
# align_by_duration — overlay curves with different date ranges
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class AlignedCurves:
    """Return type of :func:`align_by_duration`.

    Attributes:
        time: Synthetic time axis (elapsed ms since t=0), one entry per bar
            on the longest input curve. Use this as ``time`` on your
            ``Price``/``bars`` block.
        values: Per-curve ``list[float]`` — same order as the input curves,
            each right-padded with ``None`` (rendered as a gap) to
            ``len(time)``.
        bar_interval_ms: Resolved sample spacing in ms (user-supplied or
            inferred from the longest curve's timestamps).
    """

    time: list[float]
    values: list[list[float | None]]
    bar_interval_ms: float


def align_by_duration(
    curves: Sequence[dict],
    *,
    bar_interval_ms: float | None = None,
) -> AlignedCurves:
    """Overlay curves that don't share the same wall-clock date range by
    aligning them along elapsed *duration* from each curve's start.

    Every curve is placed at index 0 on a shared synthetic time axis (in ms
    since t=0). Shorter curves are right-padded with ``None`` so the
    renderer draws them ending early instead of stretching. Combine with
    ``Display(time_format="duration")`` on the ``ChartSpec`` for
    duration-formatted axis labels (``"6M"``, ``"1Y 3M"``, ...).

    Each entry in ``curves`` is a dict with:

    - ``"values"``: the numeric series (list, numpy array, pandas Series).
    - ``"times"`` (optional): per-sample timestamps in ms since epoch. Only
      used to infer ``bar_interval_ms`` when it is not supplied — sample
      spacing is expected to be uniform. Pandas ``DatetimeIndex`` /
      datetime64 ``Series`` are auto-converted to ms.

    All curves are assumed to share the same sample spacing (typically
    daily). Mixed frequencies must be resampled by the caller.

    Example::

        from finterion_charts import ChartSpec, Display, Indicator, align_by_duration

        aligned = align_by_duration([
            {"values": algo_a["equity"], "times": algo_a["timestamps"]},  # 504 daily bars
            {"values": algo_b["equity"], "times": algo_b["timestamps"]},  # 320 daily bars
        ])

        n = len(aligned.time)
        spec = (
            ChartSpec(display=Display(theme="finterion-light", time_format="duration"))
            .with_bars(time=aligned.time, open=[1.0]*n, high=[1.0]*n, low=[1.0]*n, close=[1.0]*n)
            .add_panel(Indicator.panel(
                id="equity", weight=1,
                values=aligned.values[0], color=algo_a["color"], label=algo_a["label"],
                ref_lines=[1.0],
                overlays=[Indicator(
                    values=aligned.values[1], kind="line",
                    color=algo_b["color"], label=algo_b["label"],
                )],
            ))
        )
    """
    if not curves:
        return AlignedCurves(time=[], values=[], bar_interval_ms=bar_interval_ms or 86_400_000.0)

    # Coerce every curve's values into a plain list of float|None with NaN → None.
    coerced_values: list[list[float | None]] = []
    coerced_times: list[list[float] | None] = []
    longest_len = 0
    longest_idx = -1
    for i, c in enumerate(curves):
        if not isinstance(c, dict) or "values" not in c:
            raise TypeError(
                f"curves[{i}] must be a dict with a 'values' key (got {type(c).__name__})"
            )
        v = _to_jsonable_floats(c["values"], allow_null=True)
        coerced_values.append(v)
        t = c.get("times")
        coerced_times.append(_to_time_array(t) if t is not None else None)
        if len(v) > longest_len:
            longest_len = len(v)
            longest_idx = i

    # Resolve bar spacing.
    resolved = bar_interval_ms
    if resolved is None or not isfinite(float(resolved)) or float(resolved) <= 0:
        resolved = _infer_bar_spacing_ms(coerced_times, longest_idx)
    if resolved is None:
        resolved = 86_400_000.0
    resolved = float(resolved)

    # Synthetic axis 0, bar, 2*bar, ...
    time = [i * resolved for i in range(longest_len)]

    # Right-pad each curve to `longest_len`.
    padded: list[list[float | None]] = []
    for v in coerced_values:
        if len(v) < longest_len:
            v = list(v) + [None] * (longest_len - len(v))
        padded.append(v)

    return AlignedCurves(time=time, values=padded, bar_interval_ms=resolved)


def _infer_bar_spacing_ms(times_list: list[list[float] | None], preferred_idx: int) -> float | None:
    """Median inter-sample gap of the first curve (starting with
    ``preferred_idx``) that has at least 2 timestamps. Returns ``None`` if
    none is usable."""
    order: list[int] = []
    if 0 <= preferred_idx < len(times_list):
        order.append(preferred_idx)
    for i in range(len(times_list)):
        if i != preferred_idx:
            order.append(i)
    for i in order:
        t = times_list[i]
        if not t or len(t) < 2:
            continue
        gaps = sorted(t[j] - t[j - 1] for j in range(1, len(t)))
        mid = len(gaps) // 2
        med = gaps[mid] if len(gaps) % 2 else (gaps[mid - 1] + gaps[mid]) / 2
        if isfinite(med) and med > 0:
            return float(med)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Indicator series (used both as standalone indicator and as overlay)
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class Indicator:
    """A single indicator series. Use as overlay or as the body of an `indicator` panel.

    For a complete `indicator` panel (with id / weight / title), use
    :meth:`Indicator.panel` or :func:`IndicatorPanel`.
    """

    values: ValuesRef
    kind: IndicatorKind = "line"
    color: str = "#a3ff12"
    glow: str | None = None
    line_style: LineStyleName | LineStyle | None = None
    color_negative: str | None = None
    lower_values: ValuesRef | None = None
    ref_lines: Sequence[float] | None = None
    y_range: tuple[float, float] | None = None
    id: str | None = None
    label: str | None = None
    metric: str | None = None
    toggleable: bool | None = None
    hidden: bool | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "values": _values_ref(self.values),
            "kind": self.kind,
            "color": self.color,
        }
        if self.glow is not None:
            d["glow"] = self.glow
        if self.line_style is not None:
            d["lineStyle"] = str(self.line_style)
        if self.color_negative is not None:
            d["colorNegative"] = self.color_negative
        if self.lower_values is not None:
            d["lowerValues"] = _values_ref(self.lower_values)
        if self.ref_lines is not None:
            d["refLines"] = [float(v) for v in self.ref_lines]
        if self.y_range is not None:
            d["yRange"] = [float(self.y_range[0]), float(self.y_range[1])]
        if self.id is not None:
            d["id"] = self.id
        if self.label is not None:
            d["label"] = self.label
        if self.metric is not None:
            d["metric"] = self.metric
        if self.toggleable is not None:
            d["toggleable"] = bool(self.toggleable)
        if self.hidden is not None:
            d["hidden"] = bool(self.hidden)
        return d

    # ---- convenience constructors ------------------------------------------

    @classmethod
    def line(cls, values: ValuesRef, color: str = "#a3ff12", **kw: Any) -> "Indicator":
        return cls(values=values, kind="line", color=color, **kw)

    @classmethod
    def area(cls, values: ValuesRef, color: str = "#a3ff12", **kw: Any) -> "Indicator":
        return cls(values=values, kind="area", color=color, **kw)

    @classmethod
    def histogram(cls, values: ValuesRef, color: str = "#a3ff12", **kw: Any) -> "Indicator":
        return cls(values=values, kind="histogram", color=color, **kw)

    @classmethod
    def band(
        cls,
        upper: ValuesRef,
        lower: ValuesRef,
        color: str = "rgba(0,229,255,0.7)",
        **kw: Any,
    ) -> "Indicator":
        return cls(values=upper, lower_values=lower, kind="band", color=color, **kw)

    @classmethod
    def panel(
        cls,
        *,
        id: str,
        weight: float,
        values: ValuesRef,
        kind: IndicatorKind = "line",
        color: str = "#a3ff12",
        title: str | None = None,
        title_color: str | None = None,
        ref_lines: Sequence[float] | None = None,
        y_range: tuple[float, float] | None = None,
        glow: str | None = None,
        color_negative: str | None = None,
        lower_values: ValuesRef | None = None,
        label: str | None = None,
        metric: str | None = None,
        overlays: Sequence["Indicator"] | None = None,
    ) -> "IndicatorPanel":
        return IndicatorPanel(
            id=id,
            weight=weight,
            title=title,
            title_color=title_color,
            indicator=cls(
                values=values,
                kind=kind,
                color=color,
                glow=glow,
                color_negative=color_negative,
                lower_values=lower_values,
                ref_lines=ref_lines,
                y_range=y_range,
                label=label,
                metric=metric,
            ),
            overlays=list(overlays) if overlays else None,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Panels
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class _BasePanel:
    id: str
    weight: float
    title: str | None = None
    title_color: str | None = None

    def _base(self, kind: str) -> dict[str, Any]:
        d: dict[str, Any] = {"id": self.id, "kind": kind, "weight": float(self.weight)}
        if self.title is not None:
            d["title"] = self.title
        if self.title_color is not None:
            d["titleColor"] = self.title_color
        return d


@dataclass
class Price(_BasePanel):
    type: SeriesTypeName | SeriesType = "candles"
    overlays: list[Indicator] | None = None

    def to_dict(self) -> dict[str, Any]:
        d = self._base("price")
        d["type"] = str(self.type)
        if self.overlays:
            d["overlays"] = [o.to_dict() for o in self.overlays]
        return d


@dataclass
class IndicatorPanel(_BasePanel):
    indicator: Indicator | None = None  # required, but kw-only via dataclass default
    overlays: list[Indicator] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.indicator is None:
            raise ValueError(f"IndicatorPanel '{self.id}' requires an indicator")
        d = self._base("indicator")
        d["indicator"] = self.indicator.to_dict()
        if self.overlays:
            d["overlays"] = [o.to_dict() for o in self.overlays]
        return d


@dataclass
class Heatmap(_BasePanel):
    rows: Sequence[str] = ()
    cols: Sequence[str] = ()
    values: Sequence[Sequence[float | None]] = ()
    format: FormatDirective | None = None
    range: float | None = None
    color_scale: tuple[str, str, str] | None = None  # (neg, mid, pos)
    x_label: str | None = None
    y_label: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = self._base("heatmap")
        d["rows"] = list(self.rows)
        d["cols"] = list(self.cols)
        d["values"] = [
            [
                None if (v is None or (isinstance(v, float) and isnan(v))) else float(v)
                for v in row
            ]
            for row in self.values
        ]
        if self.format is not None:
            d["format"] = self.format
        if self.range is not None:
            d["range"] = float(self.range)
        if self.color_scale is not None:
            neg, mid, pos = self.color_scale
            d["colorScale"] = {"neg": neg, "mid": mid, "pos": pos}
        if self.x_label is not None:
            d["xLabel"] = self.x_label
        if self.y_label is not None:
            d["yLabel"] = self.y_label
        return d


@dataclass
class HBar(_BasePanel):
    categories: Sequence[str] = ()
    values: NumericSeq = ()
    positive_color: str | None = None
    negative_color: str | None = None
    show_mean: bool | None = None
    format: FormatDirective | None = None
    x_label: str | None = None
    y_label: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = self._base("hbar")
        d["categories"] = list(self.categories)
        d["values"] = _to_jsonable_floats(self.values, allow_null=False)
        if self.positive_color is not None:
            d["positiveColor"] = self.positive_color
        if self.negative_color is not None:
            d["negativeColor"] = self.negative_color
        if self.show_mean is not None:
            d["showMean"] = bool(self.show_mean)
        if self.format is not None:
            d["format"] = self.format
        if self.x_label is not None:
            d["xLabel"] = self.x_label
        if self.y_label is not None:
            d["yLabel"] = self.y_label
        return d


@dataclass
class Histogram(_BasePanel):
    values: NumericSeq = ()
    bins: int | None = None
    color: str | None = None
    show_mean: bool | None = None
    format_x: FormatDirective | None = None
    x_label: str | None = None
    y_label: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = self._base("histogram")
        d["values"] = _to_jsonable_floats(self.values, allow_null=False)
        if self.bins is not None:
            d["bins"] = int(self.bins)
        if self.color is not None:
            d["color"] = self.color
        if self.show_mean is not None:
            d["showMean"] = bool(self.show_mean)
        if self.format_x is not None:
            d["formatX"] = self.format_x
        if self.x_label is not None:
            d["xLabel"] = self.x_label
        if self.y_label is not None:
            d["yLabel"] = self.y_label
        return d


@dataclass
class Scatter(_BasePanel):
    points: Sequence[tuple[float, float] | dict] = ()
    point_color: str | None = None
    point_radius: float | None = None
    identity_line: bool | None = None
    x_range: tuple[float, float] | None = None
    y_range: tuple[float, float] | None = None
    format_x: FormatDirective | None = None
    format_y: FormatDirective | None = None
    x_label: str | None = None
    y_label: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = self._base("scatter")
        out_pts: list[dict[str, float]] = []
        for p in self.points:
            if isinstance(p, dict):
                out_pts.append({"x": float(p["x"]), "y": float(p["y"])})
            else:
                x, y = p
                out_pts.append({"x": float(x), "y": float(y)})
        d["points"] = out_pts
        if self.point_color is not None:
            d["pointColor"] = self.point_color
        if self.point_radius is not None:
            d["pointRadius"] = float(self.point_radius)
        if self.identity_line is not None:
            d["identityLine"] = bool(self.identity_line)
        if self.x_range is not None:
            d["xRange"] = [float(self.x_range[0]), float(self.x_range[1])]
        if self.y_range is not None:
            d["yRange"] = [float(self.y_range[0]), float(self.y_range[1])]
        if self.format_x is not None:
            d["formatX"] = self.format_x
        if self.format_y is not None:
            d["formatY"] = self.format_y
        if self.x_label is not None:
            d["xLabel"] = self.x_label
        if self.y_label is not None:
            d["yLabel"] = self.y_label
        return d


Panel = Union[Price, IndicatorPanel, Heatmap, HBar, Histogram, Scatter]


# ─────────────────────────────────────────────────────────────────────────────
# Markers
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class Marker:
    time: float
    side: Side
    price: float
    label: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "time": float(self.time),
            "side": self.side,
            "price": float(self.price),
        }
        if self.label is not None:
            d["label"] = self.label
        return d


# ─────────────────────────────────────────────────────────────────────────────
# Display
# ─────────────────────────────────────────────────────────────────────────────


BrandingPosition = Literal["bottom-left", "bottom-right", "top-left", "top-right"]


@dataclass
class Branding:
    """Customise the "Powered by Finterion" attribution badge.

    All fields are optional. Pass an instance to ``ChartSpec(branding=...)``
    to override the default text/SVG/position. Use ``branding=False`` on
    ``ChartSpec`` to hide it entirely — subject to the LICENSE trademark
    policy (open-source forks must keep the badge unless they have a
    commercial agreement with Finterion or they no longer market the
    product as "Finterion Charts").
    """

    text: str | None = None
    svg: str | None = None
    href: str | None = None
    position: BrandingPosition | None = None
    opacity: float | None = None
    color: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {}
        if self.text is not None:
            d["text"] = self.text
        if self.svg is not None:
            d["svg"] = self.svg
        if self.href is not None:
            d["href"] = self.href
        if self.position is not None:
            d["position"] = self.position
        if self.opacity is not None:
            d["opacity"] = float(self.opacity)
        if self.color is not None:
            d["color"] = self.color
        return d


@dataclass
class Display:
    theme: ThemeName | Theme | None = None
    background: str | None = None
    grid_color: str | None = None
    grid_style: GridStyle | None = None
    panel_gap: float | None = None
    title_color: str | None = None
    title_font_size: float | None = None
    title_space: float | None = None
    show_time_axis: bool | None = None
    show_legend: bool | Literal["auto"] | None = None
    #: Initial viewport as a percentage of the buffer visible.
    #: ``100`` = fully zoomed out (all bars). Smaller values zoom IN
    #: (e.g. ``25`` shows the most recent quarter). Range: ``(0, 100]``.
    initial_zoom: float | None = None
    #: Time-axis label format.
    #:
    #: - ``"duration"`` — render tick labels as elapsed durations
    #:   (``"6M"``, ``"1Y 3M"``, ``"12d"``). Use together with
    #:   :func:`align_by_duration` when overlaying curves that don't share
    #:   the same wall-clock dates.
    #: - a token template such as ``"YYYY-MM"``, ``"MMM YYYY"``,
    #:   ``"DD/MM/YYYY"``. Supported tokens: ``YYYY``, ``YY``, ``MMM``,
    #:   ``MM``, ``DD``, ``HH``, ``mm``.
    #:
    #: When ``None`` the built-in adaptive formatter is used.
    time_format: str | None = None
    #: "Powered by Finterion" attribution badge.
    #: - ``None`` (default): show the standard badge.
    #: - ``False``: hide the badge (see Branding docstring re: trademark policy).
    #: - ``Branding(...)`` instance: customize the badge.
    branding: bool | Branding | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {}
        if self.theme is not None:
            d["theme"] = str(self.theme)
        if self.background is not None:
            d["background"] = self.background
        if self.grid_color is not None:
            d["gridColor"] = self.grid_color
        if self.grid_style is not None:
            d["gridStyle"] = self.grid_style
        if self.panel_gap is not None:
            d["panelGap"] = float(self.panel_gap)
        if self.title_color is not None:
            d["titleColor"] = self.title_color
        if self.title_font_size is not None:
            d["titleFontSize"] = float(self.title_font_size)
        if self.title_space is not None:
            d["titleSpace"] = float(self.title_space)
        if self.show_time_axis is not None:
            d["showTimeAxis"] = bool(self.show_time_axis)
        if self.show_legend is not None:
            d["showLegend"] = self.show_legend
        if self.initial_zoom is not None:
            iz = float(self.initial_zoom)
            if not (0 < iz <= 100):
                raise ValueError(
                    f"initial_zoom must be in the range (0, 100] (got {iz}). "
                    "100 = fully zoomed out (all bars visible)."
                )
            d["initialZoom"] = iz
        if self.time_format is not None:
            tf = str(self.time_format)
            if not tf:
                raise ValueError("time_format must be a non-empty string.")
            d["timeFormat"] = tf
        if self.branding is not None:
            if isinstance(self.branding, bool):
                d["branding"] = self.branding
            elif isinstance(self.branding, Branding):
                d["branding"] = self.branding.to_dict()
            else:
                raise TypeError(
                    f"branding must be bool or Branding, got {type(self.branding).__name__}"
                )
        return d


# ─────────────────────────────────────────────────────────────────────────────
# Top-level builder
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_EMBED_BASE = "https://charts.finterion.com/embed/"


def _html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _html_attr_escape(s: str) -> str:
    return _html_escape(s).replace('"', "&quot;").replace("'", "&#39;")


# Self-contained HTML wrapper written to a temp dir by `ChartSpec.show()`.
# Loads the public embed iframe and posts the spec via postMessage — no URL
# length limit, no server required on the Python side. The embed app emits
# `{type: 'finterion:ready'}` once mounted, at which point we post the spec.
_SHOW_HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title}</title>
<style>
  html, body {{ margin: 0; padding: 0; height: 100%; background: #131722; }}
  iframe {{ display: block; width: 100%; height: {height}px; border: 0; }}
</style>
</head>
<body>
<iframe id="chart" src="{embed_src}" allow="clipboard-write"></iframe>
<script>
  const SPEC = {spec_json};
  const iframe = document.getElementById('chart');
  let posted = false;
  function postSpec() {{
    if (posted) return;
    posted = true;
    iframe.contentWindow.postMessage({{ type: 'finterion:spec', spec: SPEC }}, '*');
  }}
  // Embed app posts {{type: 'finterion:ready'}} once mounted; respond with the spec.
  window.addEventListener('message', (ev) => {{
    if (ev && ev.data && ev.data.type === 'finterion:ready') postSpec();
  }});
  // Fallback if the ready signal is missed (race on already-loaded iframe).
  iframe.addEventListener('load', () => setTimeout(postSpec, 200));
</script>
</body>
</html>
"""


@dataclass
class ChartSpec:
    """Top-level chart spec builder.

    Mirrors the JSON ``ChartSpec`` shape from `@finterion/charts-spec` v1.
    Use chained ``.with_*`` / ``.add_*`` methods to populate, then
    :meth:`to_dict` / :meth:`to_json` / :meth:`embed_url` to emit.
    """

    display: Display = field(default_factory=Display)
    bars: dict[str, list[float]] | None = None
    columns: dict[str, list[float | None]] = field(default_factory=dict)
    markers: list[Marker] = field(default_factory=list)
    panels: list[Panel] = field(default_factory=list)

    # Convenience kwargs for Display so users don't have to construct it explicitly.
    def __init__(
        self,
        *,
        theme: ThemeName | Theme | None = None,
        background: str | None = None,
        grid_color: str | None = None,
        grid: GridStyle | None = None,
        panel_gap: float | None = None,
        title_color: str | None = None,
        title_font_size: float | None = None,
        title_space: float | None = None,
        show_time_axis: bool | None = None,
        show_legend: bool | Literal["auto"] | None = None,
        initial_zoom: float | None = None,
        branding: bool | Branding | None = None,
        time_format: str | None = None,
    ) -> None:
        self.display = Display(
            theme=theme,
            background=background,
            grid_color=grid_color,
            grid_style=grid,
            panel_gap=panel_gap,
            title_color=title_color,
            title_font_size=title_font_size,
            title_space=title_space,
            show_time_axis=show_time_axis,
            show_legend=show_legend,
            initial_zoom=initial_zoom,
            branding=branding,
            time_format=time_format,
        )
        self.bars = None
        self.columns = {}
        self.markers = []
        self.panels = []

    # ---- bars / columns / markers ------------------------------------------

    def with_bars(
        self,
        time: NumericSeq | None = None,
        open: NumericSeq | None = None,  # noqa: A002 - matches the JSON field name
        high: NumericSeq | None = None,
        low: NumericSeq | None = None,
        close: NumericSeq | None = None,
        volume: NumericSeq | None = None,
        *,
        df: Any | None = None,
    ) -> "ChartSpec":
        """Attach OHLC bars.

        Either pass arrays explicitly, or pass a pandas DataFrame as ``df=``;
        in the latter case, the columns ``time``/``open``/``high``/``low``/
        ``close`` (case-insensitive) are picked up. ``volume`` is optional. The
        DataFrame index is used as ``time`` if no ``time`` column is present.
        """
        if df is not None:
            try:
                import pandas as pd  # type: ignore[import-not-found]
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError(
                    "with_bars(df=...) requires pandas. "
                    "Install with: pip install 'finterion-charts[pandas]'"
                ) from exc
            if not isinstance(df, pd.DataFrame):
                raise TypeError("df must be a pandas DataFrame")
            cmap = {c.lower(): c for c in df.columns}

            def _col(name: str) -> Any:
                if name in cmap:
                    return df[cmap[name]]
                raise KeyError(f"DataFrame missing required column '{name}'")

            time_col = df[cmap["time"]] if "time" in cmap else df.index
            time = time_col
            open = _col("open")  # noqa: A001
            high = _col("high")
            low = _col("low")
            close = _col("close")
            if "volume" in cmap:
                volume = df[cmap["volume"]]

        if time is None or open is None or high is None or low is None or close is None:
            raise ValueError("with_bars requires time, open, high, low, close arrays")

        bars: dict[str, list[float]] = {
            "time": _to_time_array(time),
            "open": _to_jsonable_floats(open, allow_null=False),  # type: ignore[arg-type]
            "high": _to_jsonable_floats(high, allow_null=False),  # type: ignore[arg-type]
            "low": _to_jsonable_floats(low, allow_null=False),  # type: ignore[arg-type]
            "close": _to_jsonable_floats(close, allow_null=False),  # type: ignore[arg-type]
        }
        if volume is not None:
            bars["volume"] = _to_jsonable_floats(volume, allow_null=False)  # type: ignore[arg-type]

        # Sanity: all arrays must agree on length.
        n = len(bars["time"])
        for k, v in bars.items():
            if len(v) != n:
                raise ValueError(
                    f"OHLC arrays have inconsistent lengths "
                    f"(time={n}, {k}={len(v)})"
                )
        self.bars = bars
        return self

    def with_column(self, name: str, values: NumericSeq) -> "ChartSpec":
        """Add a named numeric column referenced by indicator panels via ``"name"``."""
        if not name:
            raise ValueError("column name must be a non-empty string")
        self.columns[name] = _to_jsonable_floats(values)  # type: ignore[assignment]
        return self

    def with_columns(self, mapping: dict[str, NumericSeq]) -> "ChartSpec":
        for k, v in mapping.items():
            self.with_column(k, v)
        return self

    def add_marker(self, marker: Marker) -> "ChartSpec":
        self.markers.append(marker)
        return self

    def add_markers(self, markers: Iterable[Marker]) -> "ChartSpec":
        self.markers.extend(markers)
        return self

    # ---- panels ------------------------------------------------------------

    def add_panel(self, panel: Panel) -> "ChartSpec":
        self.panels.append(panel)
        return self

    def add_panels(self, panels: Iterable[Panel]) -> "ChartSpec":
        self.panels.extend(panels)
        return self

    # ---- emit --------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        spec: dict[str, Any] = {"version": SPEC_VERSION}

        data: dict[str, Any] = {}
        if self.bars is not None:
            data["bars"] = self.bars
        if self.columns:
            data["columns"] = self.columns
        if self.markers:
            data["markers"] = [m.to_dict() for m in self.markers]
        if data:
            spec["data"] = data

        display = self.display.to_dict()
        if display:
            spec["display"] = display

        if not self.panels:
            raise ValueError("ChartSpec requires at least one panel")
        spec["panels"] = [p.to_dict() for p in self.panels]
        return spec

    def validate(self, *, strict: bool = False) -> "ChartSpec":
        """Validate and return self (for chaining).

        With ``strict=True`` runs the JSON Schema validator (requires the
        ``jsonschema`` extra). The default fast validator mirrors the TS one.
        """
        d = self.to_dict()
        result = validate_spec(d)
        result.raise_if_invalid()
        if strict:
            from .validator import validate_schema

            validate_schema(d).raise_if_invalid()
        return self

    def to_json(self, path: str | None = None, *, indent: int | None = None) -> str:
        """Serialise to a JSON string. If ``path`` is given, also write to disk."""
        import json

        text = json.dumps(
            self.to_dict(),
            separators=(",", ":") if indent is None else (",", ": "),
            ensure_ascii=False,
            allow_nan=False,
            indent=indent,
        )
        if path is not None:
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
        return text

    def encode(self) -> str:
        """Base64url-encoded ChartSpec, suitable for the embed iframe ``#spec=`` fragment."""
        return encode_spec(self.to_dict())

    def embed_url(self, base: str = DEFAULT_EMBED_BASE) -> str:
        """Build a fully-qualified embed URL: ``{base}#spec={encoded}``."""
        return f"{base.rstrip('#')}#spec={self.encode()}"

    def display_in_jupyter(
        self,
        *,
        base: str | None = None,
        width: int | str = "100%",
        height: int | str = 480,
    ) -> Any:
        """Return an IPython display object that renders the chart inline.

        With no ``base`` (default), the spec is rendered offline via the
        embed bundle shipped in the wheel — self-contained ``<iframe srcdoc>``,
        no network or server required. Pass ``base="https://…/embed/"`` to
        point an ``IFrame`` at a hosted embed app instead.
        """
        from .display import display_spec

        return display_spec(self, base=base, width=width, height=height)

    def show(
        self,
        *,
        base: str = DEFAULT_EMBED_BASE,
        height: int = 600,
        title: str = "Finterion Chart",
        open_browser: bool = True,
    ) -> str:
        """Open the chart in the system's default browser.

        Writes a small self-contained HTML wrapper to a temp directory that
        loads the Finterion embed iframe and posts the spec to it via
        ``postMessage`` — sidestepping URL-length limits with large specs.
        Requires the embed app at ``base`` to be reachable (default: the
        public Finterion embed). Returns the temp file path.
        """
        import json as _json
        import os
        import tempfile
        import webbrowser

        spec_json = _json.dumps(self.to_dict(), separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        embed_src = base.rstrip("#")
        html = _SHOW_HTML_TEMPLATE.format(
            title=_html_escape(title),
            embed_src=_html_attr_escape(embed_src),
            spec_json=spec_json.replace("</", "<\\/"),
            height=int(height),
        )

        tmp_dir = tempfile.mkdtemp(prefix="finterion-charts-")
        path = os.path.join(tmp_dir, "chart.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        if open_browser:
            webbrowser.open("file://" + path)
        return path


__all__ = [
    "ChartSpec",
    "Display",
    "HBar",
    "Heatmap",
    "Histogram",
    "Indicator",
    "IndicatorPanel",
    "Marker",
    "Panel",
    "Price",
    "Scatter",
]
