/**
 * Finterion design system — minimal subset extracted from
 * `design/FINTERION_DESIGN.md`, hand-typed so the playground demos can apply
 * the system without pulling in a full theme runtime.
 *
 * Light-first canvas, hairline borders, monospace numbers. See the design
 * doc for the full token set.
 */

export const colors = {
  // Brand / action
  primary: '#0969da',
  primaryHover: '#0860c8',
  primaryDeep: '#0550ae',
  primarySubtle: '#ddf4ff',
  onPrimary: '#ffffff',

  // Ink (text)
  ink: '#1f2328',
  inkMuted: '#59636e',
  inkSubtle: '#6e7781',
  inkDisabled: '#8c959f',

  // Surfaces (light)
  canvas: '#ffffff',
  canvasSubtle: '#f6f8fa',
  canvasInset: '#eaeef2',
  canvasStripe: '#fbfcfd',
  surfaceStrong: '#eaeef2',

  // Surfaces (console / dark)
  surfaceDark: '#0d1117',
  surfaceDarkElevated: '#161b22',
  surfaceConsole: '#0b0e13',
  onDark: '#f0f6fc',
  onDarkMuted: '#8b949e',

  // Borders
  hairline: '#d0d7de',
  hairlineSoft: '#e1e4e8',
  hairlineStrong: '#afb8c1',

  // Quant signal
  quantUp: '#1a7f37',
  quantUpEmphasis: '#2da44e',
  quantUpSubtle: '#dafbe1',
  quantDown: '#cf222e',
  quantDownEmphasis: '#a40e26',
  quantDownSubtle: '#ffebe9',
  quantFlat: '#6e7781',

  attention: '#9a6700',
  attentionSubtle: '#fff8c5',

  // Chart palette (fixed order)
  chartGrid: '#eaeef2',
  chartAxis: '#8c959f',
  chartSeries1: '#0969da',
  chartSeries2: '#8250df',
  chartSeries3: '#bf8700',
  chartSeries4: '#cf222e',
  chartSeries5: '#1a7f37',

  ringFocus: 'rgba(9,105,218,0.3)',
  shadowCard: 'rgba(31,35,40,0.04)',
} as const;

export const typography = {
  // Display + heading
  headingLg: 'font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:24px;line-height:1.3;letter-spacing:-0.3px;',
  headingMd: 'font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:20px;line-height:1.4;letter-spacing:-0.2px;',
  headingSm: 'font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:16px;line-height:1.5;',

  // Body
  bodyLg: 'font-family:Inter,system-ui,sans-serif;font-weight:400;font-size:16px;line-height:1.6;',
  bodyMd: 'font-family:Inter,system-ui,sans-serif;font-weight:400;font-size:14px;line-height:1.5;',
  bodySm: 'font-family:Inter,system-ui,sans-serif;font-weight:400;font-size:12px;line-height:1.5;',

  // Buttons
  buttonMd: 'font-family:Inter,system-ui,sans-serif;font-weight:500;font-size:14px;line-height:1;',
  buttonSm: 'font-family:Inter,system-ui,sans-serif;font-weight:500;font-size:12px;line-height:1;',

  // Mono — used for numbers, identifiers, ticker labels
  overline: 'font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:600;font-size:11px;line-height:1.3;letter-spacing:1px;text-transform:uppercase;',
  tickerLabel: 'font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:600;font-size:10px;line-height:1.2;letter-spacing:1.2px;text-transform:uppercase;',
  numberXl: 'font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:600;font-size:32px;line-height:1.1;letter-spacing:-0.5px;font-variant-numeric:tabular-nums;',
  numberLg: 'font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:600;font-size:24px;line-height:1.2;letter-spacing:-0.3px;font-variant-numeric:tabular-nums;',
  numberMd: 'font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:500;font-size:14px;line-height:1.4;font-variant-numeric:tabular-nums;',
  numberSm: 'font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:500;font-size:12px;line-height:1.4;font-variant-numeric:tabular-nums;',
  codeMd: 'font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,monospace;font-weight:400;font-size:13px;line-height:1.5;',
} as const;

export const radii = {
  none: 0,
  xs: 1,
  sm: 3,
  md: 4,
  lg: 5,
  xl: 6,
  full: 9999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
