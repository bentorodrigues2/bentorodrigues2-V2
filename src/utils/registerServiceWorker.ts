// Deteta sozinha uma versão nova já publicada (deploy novo na Vercel) e
// força o recarregamento — independente de o Service Worker se ter
// atualizado ou não. O "controllerchange" do SW só dispara quando o browser
// deteta que os BYTES do próprio ficheiro sw.js mudaram; como a maioria dos
// deploys só muda o código da app (bundle JS com hash novo gerado pelo
// Vite), nunca o sw.js em si, uma aba/PWA deixada aberta podia ficar presa
// a correr o JavaScript antigo em memória indefinidamente mesmo com várias
// versões novas já publicadas — tinha de ser fechada e reaberta à força
// para se notar qualquer correção. Compara o ficheiro JS principal
// referenciado no index.html publicado agora mesmo (pedido sempre com
// cache: "no-store", nunca a cache HTTP do telemóvel) contra o que está
// mesmo a correr nesta aba; se forem diferentes, há uma versão nova.
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
        console.log("[Versão] Nova versão publicada detetada — a recarregar.");
        window.location.reload();
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

    // Recarrega automaticamente assim que um Service Worker novo assume o
    // controlo — sem isto, uma aba/PWA deixada aberta continuava a correr
    // o JavaScript antigo em memória indefinidamente mesmo com uma versão
    // nova já publicada, obrigando a desinstalar/reinstalar a app para ver
    // qualquer correção (sw.js já chama skipWaiting()+clients.claim(), só
    // faltava este lado — a página em si nunca sabia que devia recarregar).
    let jaRecarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (jaRecarregou) return;
      jaRecarregou = true;
      window.location.reload();
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
