import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { purgeProvisionalDemoData } from './utils/cleanupProvisionalData';
import { registerServiceWorker } from './utils/registerServiceWorker';
import { installAuthFetchInterceptor } from './lib/authFetch';

// Anexa a sessão real do utilizador a todas as chamadas fetch("/api/...") —
// tem de ser instalado antes de qualquer outro código correr.
installAuthFetchInterceptor();

// Garantir que a base de dados local começa limpa para testes com Supabase
purgeProvisionalDemoData();

// Registar Service Worker para instalação PWA e funcionamento offline
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
