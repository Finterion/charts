import React from 'react';
import { createRoot } from 'react-dom/client';
import { MergedPlayground } from './MergedPlayground';
import { PlaygroundThemeProvider } from './finterion/themeContext';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlaygroundThemeProvider>
      <MergedPlayground />
    </PlaygroundThemeProvider>
  </React.StrictMode>,
);
