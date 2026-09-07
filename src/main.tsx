import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { purgeProvisionalDemoData } from './utils/cleanupProvisionalData';
import { registerServiceWorker } from './utils/registerServiceWorker';

// Garantir que a base de dados local começa limpa para testes com Supabase
purgeProvisionalDemoData();

// Registar Service Worker para instalação PWA e funcionamento offline
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
