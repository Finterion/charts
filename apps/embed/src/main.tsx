import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EmbedApp } from './EmbedApp';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <EmbedApp />
  </StrictMode>,
);
