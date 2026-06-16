# finterion-charts (Python)

Python binding for [Finterion Charts](https://github.com/Finterion/charts).

This package does **not render** anything. It builds, validates, and encodes
`ChartSpec` JSON — the same JSON contract consumed by `@finterion/charts-spec`.
Rendering is done in the browser by `@finterion/charts-core`, so charts produced
from Python are pixel-identical to charts produced from TypeScript.

## Install

From PyPI (once published):

```bash
pip install finterion-charts          # core: builder + cheap validator + codec
pip install "finterion-charts[schema]"   # add jsonschema-based strict validation
pip install "finterion-charts[pandas]"   # add pandas/numpy ergonomic builders
pip install "finterion-charts[jupyter]"  # add IPython iframe display helper
pip install "finterion-charts[all]"
```

From this monorepo (editable):

```bash
cd bindings/python
pip install -e ".[all,dev]"
```

## Quickstart

```python
from finterion_charts import ChartSpec, Indicator, Price, Marker

spec = (
    ChartSpec(theme="finterion-dark", background="#131722", grid="horizontal")
    .with_bars(time=time, open=o, high=h, low=l, close=c, volume=v)
    .with_column("rsi14", rsi)
    .add_panel(Price(id="price", weight=3, title="AAPL", type="candles"))
    .add_panel(Indicator.panel(
        id="rsi", weight=1, title="RSI 14",
        values="rsi14", color="#a3ff12",
        ref_lines=[30, 70], y_range=(0, 100),
    ))
    .add_marker(Marker(time=ts, side="buy",  price=lo, label="B"))
    .add_marker(Marker(time=ts, side="sell", price=hi, label="S"))
)

spec.validate()                   # raises ValueError on invalid spec
spec.to_json("chart.json")
url = spec.embed_url()            # https://charts.finterion.com/embed/#spec=…
```

See [`examples/aapl_supertrend.py`](examples/aapl_supertrend.py) for an end-to-end
example with OHLC, RSI, SuperTrend overlay, and buy/sell markers.
