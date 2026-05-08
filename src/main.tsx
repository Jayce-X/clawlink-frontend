import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { TIMProvider } from './contexts/TIMContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TIMProvider autoLogin>
      <App />
    </TIMProvider>
  </StrictMode>,
);
