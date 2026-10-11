// Mostra um aviso discreto (em vez de recarregar sozinho, sem avisar) assim
// que deteta uma versão nova publicada — pedido explícito do administrador:
// com várias publicações seguidas no mesmo dia, o recarregamento automático
// estava a interromper o que estava a ser feito de cada vez que se voltava
// à aba. Fica ao critério de quem está a usar a app escolher quando
// atualizar, nunca perde o que estava a meio.
let avisoNovaVersaoJaMostrado = false;
function mostrarAvisoNovaVersao(): void {
  if (avisoNovaVersaoJaMostrado || typeof document === "undefined") return;
  avisoNovaVersaoJaMostrado = true;

  const aviso = document.createElement("div");
  aviso.setAttribute("role", "status");
  aviso.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;background:#111827;color:#f9fafb;padding:12px 16px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:system-ui,sans-serif;font-size:13px;display:flex;align-items:center;gap:12px;max-width:92vw;";

  const texto = document.createElement("span");
  texto.textContent = "Nova versão da app disponível.";
  aviso.appendChild(texto);

  const botao = document.createElement("button");
  botao.textContent = "Atualizar agora";
  botao.style.cssText = "background:#10b981;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;";
  botao.onclick = () => window.location.reload();
  aviso.appendChild(botao);

  const fechar = document.createElement("button");
  fechar.textContent = "✕";
  fechar.setAttribute("aria-label", "Fechar aviso");
  fechar.style.cssText = "background:transparent;color:#9ca3af;border:none;font-size:14px;cursor:pointer;padding:0 2px;";
  fechar.onclick = () => aviso.remove();
  aviso.appendChild(fechar);

  document.body.appendChild(aviso);
}

// Deteta sozinha uma versão nova já publicada (deploy novo na Vercel) —
// independente de o Service Worker se ter atualizado ou não. O
// "controllerchange" do SW só dispara quando o browser deteta que os BYTES
// do próprio ficheiro sw.js mudaram; como a maioria dos deploys só muda o
// código da app (bundle JS com hash novo gerado pelo Vite), nunca o sw.js
// em si, uma aba/PWA deixada aberta podia ficar presa a correr o
// JavaScript antigo em memória indefinidamente mesmo com várias versões
// novas já publicadas. Compara o ficheiro JS principal referenciado no
// index.html publicado agora mesmo (pedido sempre com cache: "no-store",
// nunca a cache HTTP do telemóvel) contra o que está mesmo a correr nesta
// aba; se forem diferentes, há uma versão nova.
function watchForNewVersion(): void {
  const scriptAtual = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  const bundleAtual = scriptAtual?.getAttribute("src") || null;
  if (!bundleAtual) return; // ex: ambiente de dev (Vite sem build), sem bundle com hash

  const verificar = async () => {
    try {
      const res = await fetch("/index.html", { cache: "no-store" });
      if (!res.ok) return;
      const html = await res.text();
      const match = html.match(/\/assets\/index-[\w-]+\.js/);
      if (match && match[0] !== bundleAtual) {
        console.log("[Versão] Nova versão publicada detetada.");
        mostrarAvisoNovaVersao();
      }
    } catch {
      // Sem rede — não faz sentido recarregar, tenta-se de novo na próxima verificação.
    }
  };

  // Primeira verificação pouco depois de abrir (não logo de imediato, para
  // não atrasar o arranque nem recarregar em ciclo se o deploy ainda estiver
  // a propagar), depois a cada 5 minutos e sempre que a aba volta a ficar visível.
  setTimeout(verificar, 30 * 1000);
  setInterval(verificar, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verificar();
  });
}

// Register Service Worker for PWA & WebPush Notifications
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  watchForNewVersion();

  if (!('serviceWorker' in navigator)) {
    console.warn('[ServiceWorker] Service Workers não são suportados neste browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[ServiceWorker] Registado com sucesso. Scope:', registration.scope);

    // Avisa (em vez de recarregar sozinho) assim que um Service Worker novo
    // assume o controlo — sem isto, uma aba/PWA deixada aberta continuava a
    // correr o JavaScript antigo em memória indefinidamente mesmo com uma
    // versão nova já publicada (sw.js já chama skipWaiting()+clients.claim(),
    // só faltava este lado — a página em si nunca sabia que devia
    // atualizar). Quem está a usar a app escolhe quando recarregar.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      mostrarAvisoNovaVersao();
    });

    // Uma PWA/aba aberta durante horas nunca voltava, sozinha, a perguntar
    // ao servidor se havia uma versão nova — verifica a cada 5 minutos.
    setInterval(() => {
      registration.update().catch(() => {});
    }, 5 * 60 * 1000);

    // O intervalo acima só corre enquanto a app está em primeiro plano — a
    // maioria dos telemóveis suspende por completo o JavaScript de uma PWA
    // em segundo plano, por isso o intervalo simplesmente não dispara
    // enquanto a app está minimizada, por mais tempo que passe. Verifica
    // também sempre que a app volta a ficar visível (reaberta a partir de
    // segundo plano), que é precisamente o momento em que uma versão nova
    // publicada entretanto tem de ser detetada.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    });

    return registration;
  } catch (error) {
    console.error('[ServiceWorker] Falha ao registar Service Worker:', error);
    return null;
  }
}
