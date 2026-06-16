"""End-to-end example: AAPL OHLCV + RSI + SuperTrend overlay + buy/sell markers.

This script generates synthetic data and writes a `ChartSpec` JSON file plus a
shareable embed URL. Drop the resulting URL into a browser to see the chart.

    cd bindings/python
    python -m examples.aapl_supertrend
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from finterion_charts import ChartSpec, Indicator, Marker, Price


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic OHLCV — tiny random walk so the example has no external deps.
# ─────────────────────────────────────────────────────────────────────────────


def _gen_ohlcv(n: int = 250, seed: int = 42):
    rng = random.Random(seed)
    t0 = 1_700_000_000_000.0  # ms epoch
    step = 86_400_000.0  # 1 day
    time, o, h, lo, c, v = [], [], [], [], [], []
    price = 180.0
    for i in range(n):
        drift = rng.gauss(0, 1.2)
        open_ = price
        close = max(1.0, open_ + drift)
        high = max(open_, close) + abs(rng.gauss(0, 0.8))
        low = min(open_, close) - abs(rng.gauss(0, 0.8))
        time.append(t0 + i * step)
        o.append(open_)
        h.append(high)
        lo.append(low)
        c.append(close)
        v.append(1_000_000 + rng.random() * 5_000_000)
        price = close
    return time, o, h, lo, c, v


# ─────────────────────────────────────────────────────────────────────────────
# Toy indicators (the binding does not ship indicator math — bring your own).
# ─────────────────────────────────────────────────────────────────────────────


def _rsi(close: list[float], period: int = 14) -> list[float]:
    out: list[float] = [math.nan] * len(close)
    if len(close) <= period:
        return out
    gains = losses = 0.0
    for i in range(1, period + 1):
        d = close[i] - close[i - 1]
        gains += max(d, 0.0)
        losses += max(-d, 0.0)
    avg_gain = gains / period
    avg_loss = losses / period
    out[period] = 100.0 - 100.0 / (1.0 + (avg_gain / max(avg_loss, 1e-9)))
    for i in range(period + 1, len(close)):
        d = close[i] - close[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(d, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-d, 0.0)) / period
        out[i] = 100.0 - 100.0 / (1.0 + (avg_gain / max(avg_loss, 1e-9)))
    return out


def _supertrend(
    high: list[float], low: list[float], close: list[float],
    *, atr_len: int = 10, factor: float = 3.0,
):
    """Classic SuperTrend. Returns (line, trend, signal).

    trend:  1 bullish, 0 bearish
    signal: +1 buy crossover, -1 sell crossover, 0 otherwise
    """
    n = len(close)
    tr = [0.0] * n
    for i in range(1, n):
        tr[i] = max(
            high[i] - low[i],
            abs(high[i] - close[i - 1]),
            abs(low[i] - close[i - 1]),
        )
    atr = [math.nan] * n
    if n > atr_len:
        atr[atr_len] = sum(tr[1 : atr_len + 1]) / atr_len
        for i in range(atr_len + 1, n):
            atr[i] = (atr[i - 1] * (atr_len - 1) + tr[i]) / atr_len

    line: list[float] = [math.nan] * n
    trend: list[int] = [0] * n
    signal: list[int] = [0] * n

    upper = [math.nan] * n
    lower = [math.nan] * n
    for i in range(n):
        if math.isnan(atr[i]):
            continue
        mid = (high[i] + low[i]) / 2.0
        upper[i] = mid + factor * atr[i]
        lower[i] = mid - factor * atr[i]
        if i > 0 and not math.isnan(upper[i - 1]):
            if close[i - 1] <= upper[i - 1]:
                upper[i] = min(upper[i], upper[i - 1])
            if close[i - 1] >= lower[i - 1]:
                lower[i] = max(lower[i], lower[i - 1])

        prev_trend = trend[i - 1] if i > 0 else 1
        if i == 0 or math.isnan(line[i - 1]):
            trend[i] = 1 if close[i] > mid else 0
        elif close[i] > upper[i - 1]:
            trend[i] = 1
        elif close[i] < lower[i - 1]:
            trend[i] = 0
        else:
            trend[i] = prev_trend

        line[i] = lower[i] if trend[i] == 1 else upper[i]
        if i > 0 and trend[i] != prev_trend and not math.isnan(line[i - 1]):
            signal[i] = 1 if trend[i] == 1 else -1
    return line, trend, signal


def _split_by_trend(line: list[float], trend: list[int]):
    up = [v if trend[i] == 1 else math.nan for i, v in enumerate(line)]
    dn = [v if trend[i] == 0 else math.nan for i, v in enumerate(line)]
    return up, dn


# ─────────────────────────────────────────────────────────────────────────────
# Build the spec.
# ─────────────────────────────────────────────────────────────────────────────


def main() -> None:
    time, o, h, lo, c, v = _gen_ohlcv()
    rsi = _rsi(c, period=14)
    line, trend, signal = _supertrend(h, lo, c, atr_len=10, factor=3.0)
    st_up, st_dn = _split_by_trend(line, trend)

    spec = (
        ChartSpec(
            theme="finterion-dark",
            background="#131722",
            grid_color="#494d57",
            grid="horizontal",
        )
        .with_bars(time=time, open=o, high=h, low=lo, close=c, volume=v)
        .with_columns({"rsi14": rsi, "st_up": st_up, "st_dn": st_dn})
        .add_panel(
            Price(
                id="price", weight=3,
                title="AAPL · SuperTrend (ATR 10, ×3)",
                type="candles",
                overlays=[
                    Indicator.line(values="st_up", color="#00ffa3",
                                   glow="rgba(0,255,163,0.55)"),
                    Indicator.line(values="st_dn", color="#ff3d6e",
                                   glow="rgba(255,61,110,0.55)"),
                ],
            )
        )
        .add_panel(
            Indicator.panel(
                id="rsi", weight=1, title="RSI 14",
                values="rsi14", color="#a3ff12",
                ref_lines=[30, 70], y_range=(0, 100),
            )
        )
    )

    for i, s in enumerate(signal):
        if s == 1:
            spec.add_marker(Marker(time=time[i], side="buy", price=lo[i], label="B"))
        elif s == -1:
            spec.add_marker(Marker(time=time[i], side="sell", price=h[i], label="S"))

    spec.validate(strict=False)
    spec.show(base="http://localhost:5174/")  # open in browser (requires `finterion-charts` package installed)
    out_path = Path(__file__).with_name("aapl_supertrend.json")
    spec.to_json(str(out_path), indent=2)
    print(f"Wrote {out_path}")
    print(f"Embed URL:\n  {spec.embed_url()}")


if __name__ == "__main__":
    main()
