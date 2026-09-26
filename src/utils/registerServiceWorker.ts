// Register Service Worker for PWA & WebPush Notifications
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
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

    return registration;
  } catch (error) {
    console.error('[ServiceWorker] Falha ao registar Service Worker:', error);
    return null;
  }
}
