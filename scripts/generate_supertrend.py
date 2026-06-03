"""Generate a SuperTrend dataset for the Finterion Charts playground demo.

Requirements:
    pip install pyindicators pandas numpy

Output:
    apps/playground/public/supertrend.json

The JSON has the shape:
    {
      "symbol": "BTC/USD",
      "atr_length": 10,
      "factor": 3.0,
      "bars": [{ "time": <ms>, "open", "high", "low", "close", "volume" }, ...],
      "supertrend": [number|null, ...],          # trailing-stop line
      "supertrend_trend": [0|1, ...],             # 1 bullish, 0 bearish
      "supertrend_upper": [number|null, ...],
      "supertrend_lower": [number|null, ...],
      "supertrend_signal": [-1|0|1, ...]          # 1=buy, -1=sell
    }
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from pyindicators import bollinger_bands, macd, rsi, supertrend


def synth_ohlc(n: int = 800, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    start_ms = int(pd.Timestamp("2025-01-01", tz="UTC").timestamp() * 1000)
    step_ms = 3_600_000  # 1h

    price = 60_000.0
    rows = []
    for i in range(n):
        drift = math.sin(i / 28) * 220 + math.cos(i / 11) * 90
        trend = math.sin(i / 90) * 600
        noise = (rng.random() - 0.5) * 320
        o = price
        c = price + drift + trend * 0.04 + noise
        h = max(o, c) + rng.random() * 180
        l = min(o, c) - rng.random() * 180
        v = 400 + rng.random() * 1400
        rows.append({
            "time": start_ms + i * step_ms,
            "Open": o, "High": h, "Low": l, "Close": c, "Volume": v,
        })
        price = c
    return pd.DataFrame(rows)


def _clean(values):
    out = []
    for v in values:
        if v is None or (isinstance(v, float) and math.isnan(v)):
            out.append(None)
        else:
            out.append(float(v))
    return out


def main() -> None:
    df = synth_ohlc(800)
    df = supertrend(df, atr_length=10, factor=3.0)
    df = rsi(df, source_column="Close", period=14, result_column="RSI_14")
    df = bollinger_bands(
        df,
        source_column="Close",
        period=20,
        std_dev=2,
    )
    df = macd(
        df,
        source_column="Close",
        short_period=12,
        long_period=26,
        signal_period=9,
    )

    bars = [
        {
            "time": int(row.time),
            "open": float(row.Open),
            "high": float(row.High),
            "low": float(row.Low),
            "close": float(row.Close),
            "volume": float(row.Volume),
        }
        for row in df.itertuples()
    ]

    payload = {
        "symbol": "BTC/USD (synthetic)",
        "atr_length": 10,
        "factor": 3.0,
        "bars": bars,
        "supertrend": _clean(df["supertrend"].tolist()),
        "supertrend_trend": [
            int(x) if not (isinstance(x, float) and math.isnan(x)) else 0
            for x in df["supertrend_trend"].tolist()
        ],
        "supertrend_upper": _clean(df["supertrend_upper"].tolist()),
        "supertrend_lower": _clean(df["supertrend_lower"].tolist()),
        "supertrend_signal": [
            int(x) if not (isinstance(x, float) and math.isnan(x)) else 0
            for x in df["supertrend_signal"].tolist()
        ],
        "rsi_period": 14,
        "rsi": _clean(df["RSI_14"].tolist()),
        "bb_period": 20,
        "bb_std_dev": 2,
        "bb_upper": _clean(df["bollinger_upper"].tolist()),
        "bb_middle": _clean(df["bollinger_middle"].tolist()),
        "bb_lower": _clean(df["bollinger_lower"].tolist()),
        "macd_short": 12,
        "macd_long": 26,
        "macd_signal_period": 9,
        "macd": _clean(df["macd"].tolist()),
        "macd_signal": _clean(df["macd_signal"].tolist()),
        "macd_histogram": _clean(df["macd_histogram"].tolist()),
    }

    out = Path(__file__).resolve().parent.parent / "apps" / "playground" / "public" / "supertrend.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload))
    print(f"wrote {out} ({len(bars)} bars)")


if __name__ == "__main__":
    main()
