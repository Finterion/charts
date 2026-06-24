# Line Chart

Render OHLCV bars as a continuous line instead of candles. Useful for equity
curves, index comparisons, and any context where body shape adds noise rather
than signal.

## Data

Daily BTC/USD bars (2023-03-11 → 2023-07-31). Each bar has a `timestamp` ISO
string plus `open`, `high`, `low`, `close`, and `volume` fields.

```json
[
    {
        "close": 19219,
        "high": 19682,
        "low": 18655,
        "open": 18986,
        "timestamp": "2023-03-11T00:00:00",
        "volume": 430.96337327
    },
    {
        "close": 20665,
        "high": 20700,
        "low": 19097,
        "open": 19231,
        "timestamp": "2023-03-12T00:00:00",
        "volume": 570.40631158
    },
    {
        "close": 22338,
        "high": 22727,
        "low": 20265,
        "open": 20681,
        "timestamp": "2023-03-13T00:00:00",
        "volume": 1262.70186029
    },
   ...
]
```

## React

```tsx
import { Chart } from '@finterion/charts-react';
import type { OHLC } from '@finterion/charts-core';

// Raw data loaded from your API / import. The engine expects `time` as a
// millisecond epoch number, so convert the ISO timestamp on the way in.
const raw: Array<{
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> = DATA; // replace with your import or fetch result

const data: OHLC[] = raw.map((bar) => ({
  time: new Date(bar.timestamp).getTime(),
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
  volume: bar.volume,
}));

export function BtcLineChart() {
  return (
    <Chart
      data={data}
      panels={[{ id: 'price', kind: 'price', weight: 1, type: 'line' }]}
      theme="finterion-dark"
      initialFit="all"
      style={{ width: '100%', height: 400 }}
    />
  );
}
```

## Python

```python
import json
from datetime import datetime, timezone
from finterion_charts import ChartSpec, Price

# Load the data (adjust path or replace with an API call).
with open("line_chart.json") as f:
    raw = json.load(f)

# The engine expects time as millisecond epoch floats.
def _to_ms(iso: str) -> float:
    dt = datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)
    return dt.timestamp() * 1000

time   = [_to_ms(bar["timestamp"]) for bar in raw]
open_  = [bar["open"]   for bar in raw]
high   = [bar["high"]   for bar in raw]
low    = [bar["low"]    for bar in raw]
close  = [bar["close"]  for bar in raw]
volume = [bar["volume"] for bar in raw]

spec = (
    ChartSpec(theme="finterion-dark")
    .with_bars(time=time, open=open_, high=high, low=low, close=close, volume=volume)
    .add_panel(Price(id="price", weight=1, type="line"))
)

# Jupyter / VS Code notebook — renders inline:
spec.display()

# Plain Python script — opens in the default browser:
# spec.show()
```