import { useId, useMemo, useState } from 'react';
import { validateCanvasSpec, type ChartCanvasSpec } from '@finterion/charts-spec';
import { ChartFromSpec } from './ChartFromSpec';

export interface ChartCanvasProps {
  spec: ChartCanvasSpec;
  className?: string;
  style?: React.CSSProperties;
}

export function ChartCanvas({ spec, className, style }: ChartCanvasProps) {
  const validation = useMemo(() => validateCanvasSpec(spec), [spec]);
  if (!validation.ok) return <div role="alert">{validation.errors.join('\n')}</div>;
  return <CanvasContent key={JSON.stringify([Object.keys(spec.charts), spec.selected, spec.layout])} spec={spec} className={className} style={style} />;
}

function CanvasContent({ spec, className, style }: ChartCanvasProps) {
  const ids = Object.keys(spec.charts);
  const selectorId = useId();
  const [layout, setLayout] = useState(spec.layout ?? 'single');
  const [selected, setSelected] = useState(spec.selected ?? ids);
  const [active, setActive] = useState(spec.selected?.[0] ?? ids[0]!);
  const multiple = layout === 'grid';
  const type = spec.selector?.type ?? 'tabs';
  const label = spec.selector?.label ?? 'Chart';
  const visible = multiple ? selected : [active];
  const changeSelection = (id: string) => {
    if (!multiple) setActive(id);
    else setSelected(current => current.includes(id) ? current.filter(key => key !== id) : [...current, id]);
  };
  const dropdown = type === 'dropdown' || type === 'multiselect';
  return (
    <section className={className} aria-label={spec.title} style={{
      width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: '#e2e8f0', background: '#101720', font: '12px/1.5 system-ui,sans-serif', ...style,
    }}>
      <style>{`
        .finterion-canvas-controls button,.finterion-canvas-controls select {
          color:#e2e8f0;background:#1e293b;border:1px solid #475569;border-radius:5px;padding:5px 9px;font:inherit;
        }
        .finterion-canvas-controls button { cursor:pointer; }
        .finterion-canvas-controls button[aria-pressed=true] { background:#1e3a5f;border-color:#60a5fa; }
        .finterion-canvas-controls :focus-visible { outline:2px solid #60a5fa;outline-offset:2px; }
        .finterion-canvas-grid { grid-template-columns:repeat(var(--canvas-columns),minmax(0,1fr)); }
        @media(max-width:900px) { .finterion-canvas-grid { grid-template-columns:minmax(0,1fr); } }
      `}</style>
      <header className="finterion-canvas-controls" style={{ padding: 12, borderBottom: '1px solid #303943', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, margin: 0, marginRight: 'auto' }}>{spec.title}</h2>
        {dropdown ? <>
          <label htmlFor={selectorId}>{label}</label>
          <select id={selectorId} multiple={multiple} aria-label={label}
            value={multiple ? selected : active}
            onChange={event => {
              if (multiple) setSelected(Array.from(event.target.selectedOptions, option => option.value));
              else setActive(event.target.value);
            }}>
            {ids.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </> : <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <legend style={{ fontSize: 10, color: '#94a3b8' }}>{label}</legend>
          {ids.map(id => type === 'checkboxes' ? <label key={id}>
            <input type={multiple ? 'checkbox' : 'radio'} name={selectorId} checked={visible.includes(id)} onChange={() => changeSelection(id)} />{id}
          </label> : <button key={id} type="button" aria-pressed={visible.includes(id)} onClick={() => changeSelection(id)}>{id}</button>)}
        </fieldset>}
        {spec.layoutToggle !== false && <div role="group" aria-label="Canvas layout" style={{ display: 'flex', gap: 4 }}>
          {(['single', 'grid'] as const).map(value => <button key={value} type="button" aria-pressed={layout === value} onClick={() => {
            if (value === 'single' && selected.length && !selected.includes(active)) setActive(selected[0]!);
            setLayout(value);
          }}>{value === 'single' ? 'Single' : 'Grid'}</button>)}
        </div>}
      </header>
      <div className={multiple ? 'finterion-canvas-grid' : undefined} style={{
        flex: '1 1 0', minHeight: 0, overflow: 'auto', padding: 8, gap: 12, boxSizing: 'border-box',
        display: multiple ? 'grid' : 'flex', flexDirection: 'column', alignContent: 'start',
        '--canvas-columns': spec.columns ?? 2,
      } as React.CSSProperties}>
        {multiple && !selected.length && <p role="status">Select charts to display.</p>}
        {ids.map(id => <section key={id} aria-label={`Chart: ${id}`} hidden={!visible.includes(id)}
          style={{
            display: visible.includes(id) ? 'flex' : 'none', flexDirection: 'column',
            boxSizing: 'border-box',
            height: multiple ? spec.chartHeight ?? 720 : '100%', minHeight: multiple ? 0 : 360,
            minWidth: 0, flex: '1 0 auto', border: '1px solid #303943', borderRadius: 6, overflow: 'hidden',
          }}>
          <h3 style={{ margin: 0, padding: '6px 10px', fontSize: 12, color: '#94a3b8' }}>{id}</h3>
          <div style={{ flex: '1 1 0', minHeight: 0 }}>
            <ChartFromSpec spec={spec.charts[id]!} />
          </div>
        </section>)}
      </div>
    </section>
  );
}
