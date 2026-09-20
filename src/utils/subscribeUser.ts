// Subscribe user to PushManager via ServiceWorker Registration
export async function subscribeUserToPush(registration?: ServiceWorkerRegistration | null): Promise<PushSubscription | null> {
  try {
    const swReg = registration || (await navigator.serviceWorker.ready);
    if (!swReg || !swReg.pushManager) {
      console.warn('[WebPush] PushManager indisponível na aplicação.');
      return null;
    }

    // Check existing subscription
    let subscription = await swReg.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!applicationServerKey) {
        // Esta env var é lida em BUILD TIME pelo Vite — definir só no .env
        // local não chega, tem de estar nas Environment Variables do
        // projeto na Vercel (mesmo valor de VAPID_PUBLIC_KEY) e o site tem
        // de ser reconstruído a seguir para o valor ficar embutido no bundle.
        console.error('[WebPush] VITE_VAPID_PUBLIC_KEY não está definida neste build — falta configurar nas Environment Variables da Vercel e voltar a fazer deploy.');
        return null;
      }
      // Se a subscrição real falhar (chave inválida, permissão negada pelo
      // utilizador, etc.), devolve null — nunca uma subscrição fabricada, que
      // pareceria funcionar mas nunca receberia nenhuma notificação real.
      try {
        subscription = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
        });
      } catch (e) {
        console.error('[WebPush] Falha ao subscrever notificações push:', e);
        return null;
      }
    }

    console.log('[WebPush] Subscrição ativa do utilizador:', subscription);
    return subscription;
  } catch (error) {
    console.error('[WebPush] Erro ao subscrever utilizador a WebPush:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
