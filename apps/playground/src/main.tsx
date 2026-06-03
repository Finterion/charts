import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SuperTrendDemo } from './SuperTrendDemo';
import { PortfolioOverview } from './PortfolioOverview';

type Demo = 'default' | 'supertrend' | 'portfolio';

function readInitialDemo(): Demo {
  if (typeof window === 'undefined') return 'default';
  const hash = window.location.hash.replace('#', '');
  if (hash === 'supertrend') return 'supertrend';
  if (hash === 'portfolio') return 'portfolio';
  return 'default';
}

function Root() {
  const [demo, setDemo] = useState<Demo>(readInitialDemo());

  const setAndPersist = (next: Demo) => {
    setDemo(next);
    if (typeof window !== 'undefined') {
      window.location.hash = next === 'default' ? '' : next;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'fixed',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          gap: 6,
          padding: 4,
          borderRadius: 8,
          background: 'rgba(10,14,25,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(6px)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          letterSpacing: 1,
        }}
      >
        <SwitchBtn active={demo === 'default'} onClick={() => setAndPersist('default')}>
          DEFAULT
        </SwitchBtn>
        <SwitchBtn
          active={demo === 'supertrend'}
          onClick={() => setAndPersist('supertrend')}
        >
          SUPERTREND
        </SwitchBtn>
        <SwitchBtn
          active={demo === 'portfolio'}
          onClick={() => setAndPersist('portfolio')}
        >
          PORTFOLIO
        </SwitchBtn>
      </div>
      {demo === 'supertrend' ? <SuperTrendDemo /> : demo === 'portfolio' ? <PortfolioOverview /> : <App />}
    </div>
  );
}

function SwitchBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: 'none',
        background: active ? '#00e5ff' : 'transparent',
        color: active ? '#06070a' : '#e8ecf2',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        boxShadow: active ? '0 0 16px rgba(0,229,255,0.4)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
