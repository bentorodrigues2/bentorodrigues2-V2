import { Webhook } from "svix";
import { processInboundEmail } from "../../server/lib/inboundProcessor.js";

// Vercel/Next.js: desativa o parsing automático do corpo, porque a
// verificação de assinatura Svix tem de ser feita sobre os bytes exatos
// como chegaram (re-serializar o JSON já parseado pode não corresponder
// byte a byte à assinatura calculada pelo Resend).
export const config = {
  api: {
    bodyParser: false
  }
};

function lerCorpoBruto(req) {
  return new Promise((resolve, reject) => {
    let dados = "";
    req.on("data", (chunk) => { dados += chunk; });
    req.on("end", () => resolve(dados));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      endpoint: "/api/webhooks/resend",
      description: "Webhook oficial para receção e processamento automático de emails com IA."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await lerCorpoBruto(req);

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Corpo do pedido não é JSON válido." });
  }

  // Verificação de assinatura Svix (é assim que o Resend assina os seus
  // webhooks) — sem isto, qualquer pessoa que soubesse o URL deste endpoint
  // conseguia simular um "email recebido" falso, com from/subject/anexos
  // inventados, e o processInboundEmail tratava-o como real. Falha aberta
  // (avisa mas processa na mesma) apenas se RESEND_WEBHOOK_SECRET ainda não
  // estiver configurado na Vercel, para nunca partir sozinha a automação
  // real enquanto essa variável não é adicionada.
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(rawBody, {
        "svix-id": req.headers["svix-id"],
        "svix-timestamp": req.headers["svix-timestamp"],
        "svix-signature": req.headers["svix-signature"]
      });
    } catch (err) {
      console.warn("[webhook resend] Assinatura inválida — pedido rejeitado:", err?.message || err);
      return res.status(401).json({ error: "Assinatura do webhook inválida." });
    }
  } else {
    console.warn("[webhook resend] RESEND_WEBHOOK_SECRET não configurado — a processar SEM verificar a assinatura do Resend. Define esta variável de ambiente na Vercel para proteger este endpoint.");
  }

  try {
    const result = await processInboundEmail(payload);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    console.error("Erro no webhook /api/webhooks/resend:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no processamento do webhook",
      detail: err?.message || String(err)
    });
  }
}
