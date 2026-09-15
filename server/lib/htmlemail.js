/**
 * Utilitários para geração de templates HTML de emails institucionais.
 * Reutiliza o logótipo e assinatura oficiais já definidos em geminiService.js
 * (mesma marca em todos os emails: autoresponder, resposta por categoria,
 * router institucional).
 */
import { AI_STUDIO_ROUTER_LOGO_HTML, AI_STUDIO_ROUTER_SIGNATURE_HTML } from "../geminiService.js";

export function gerarHtmlAutoresponder(nome = "Condómino") {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Recebemos o seu contacto</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  ${AI_STUDIO_ROUTER_LOGO_HTML}
  <div style="border: 1px solid #e2e8f0; padding: 28px; border-radius: 8px; background-color: #ffffff;">
    <p style="font-size: 16px; margin-top: 0;">Olá <strong>${nome}</strong>,</p>
    <p>Agradecemos o seu contacto.</p>
    <div style="text-align: center; margin: 20px 0;">
      <img src="https://bentorodrigues2.vercel.app/email/20-email-opt.webp"
           alt="O seu email foi recebido pela administração do condomínio"
           style="width: 100%; max-width: 360px; height: auto; border-radius: 12px; display: inline-block;" />
    </div>
    <div style="background-color: #f1f5f9; border-left: 4px solid #0284c7; padding: 14px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; font-size: 14px; color: #334155;">
        <strong>Informação:</strong> Comprovativos de pagamento e participações de ocorrências são processados com prioridade, para uma resposta mais rápida relembramos que pode usar a aplicação do condomínio.
      </p>
    </div>
    <p style="margin-top: 28px; font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 16px;">
      Esta é uma notificação automática de confirmação de entrega.
      ${AI_STUDIO_ROUTER_SIGNATURE_HTML}
    </p>
  </div>
</body>
</html>`;
}

export function gerarHtmlResposta(nome = "Condómino", mensagem = "") {
  const mensagemFormatada = String(mensagem).replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Comunicação Oficial do Condomínio</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  ${AI_STUDIO_ROUTER_LOGO_HTML}
  <div style="border: 1px solid #e2e8f0; padding: 28px; border-radius: 8px; background-color: #ffffff;">
    <p style="font-size: 16px; margin-top: 0;">Estimado(a) <strong>${nome}</strong>,</p>
    <div style="margin: 20px 0; padding: 18px; background-color: #f8fafc; border-left: 4px solid #0f766e; border-radius: 0 6px 6px 0; font-size: 15px;">
      ${mensagemFormatada}
    </div>
    <p style="margin-top: 28px; font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 16px;">
      ${AI_STUDIO_ROUTER_SIGNATURE_HTML}
    </p>
  </div>
</body>
</html>`;
}

export default {
  gerarHtmlAutoresponder,
  gerarHtmlResposta
};
