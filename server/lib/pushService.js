import webpush from "web-push";
import { supabase } from "./supabaseServer.js";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:administracao@condomanagerai.com";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Envia uma notificação push real só às subscrições de Administração
 * (push_subscriptions.is_admin = true) de um prédio — extraído de
 * api/admin.js?acao=enviar-push-admin para poder ser chamado diretamente
 * a partir de código de servidor (ex: webhooks) sem precisar de sessão
 * HTTP nem de um pedido fetch interno ao próprio deployment.
 */
export async function enviarPushAdmin({ id_predio, title, body, url }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !id_predio || !title || !body) return { ok: false, enviados: 0 };

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("id_predio", id_predio)
    .eq("is_admin", true);
  if (error) {
    console.warn("[pushService] Erro ao obter subscrições de admin:", error.message);
    return { ok: false, enviados: 0 };
  }

  const payload = JSON.stringify({ title, body, url: url || "/" });
  let enviados = 0;
  for (const row of subs || []) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      enviados += 1;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id);
      } else {
        console.warn("[pushService] Falha ao enviar para uma subscrição:", err?.message || err);
      }
    }
  }
  return { ok: true, enviados };
}
