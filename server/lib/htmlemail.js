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
      <img src="https://bentorodrigues2.condomanagerai.com/email/20-email-opt.webp"
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

/**
 * Cartão de aniversário como corpo do próprio email (não como PDF em anexo —
 * pedido explícito: "não faz sentido enviarmos como anexo"). Inclui a
 * assinatura digital real do administrador quando existir
 * (predios.patrimonio.assinatura_admin_base64), com fallback para o nome.
 */
export function gerarHtmlAniversario({ nome, predioNome, adminNome, adminSignatureBase64 }) {
  const nomeDestinatario = nome || "Condómino(a)";
  const nomeEdificio = predioNome || "Condomínio";
  const nomeAdmin = adminNome || "A Administração do Condomínio";

  const assinaturaHtml =
    adminSignatureBase64 && adminSignatureBase64.startsWith("data:image")
      ? `<img src="${adminSignatureBase64}" alt="Assinatura do Administrador" style="height: 34px; margin: 6px 0 4px;" />`
      : "";

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Feliz Aniversário!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  ${AI_STUDIO_ROUTER_LOGO_HTML}
  <div style="border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #0b1426 0%, #0f172a 100%); padding: 22px 28px; text-align: center;">
      <p style="margin: 0; font-size: 11px; letter-spacing: 1px; color: #7dd3fc; text-transform: uppercase; font-weight: 600;">${nomeEdificio.toUpperCase()}</p>
      <h1 style="margin: 6px 0 0; font-size: 26px; color: #ffffff;">🎉 Feliz Aniversário!</h1>
    </div>
    <div style="padding: 28px;">
      <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 14px 18px; text-align: center; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #0b1426;">Exmo.(a) Sr.(a) ${nomeDestinatario},</p>
      </div>
      <p style="font-size: 15px;">A Administração do condomínio <strong>${nomeEdificio}</strong> tem o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais junto de quem mais estima.</p>
      <p style="font-size: 15px;">Agradecemos o seu contributo diário para a harmonia e bom convívio no nosso edifício.</p>
      <div style="text-align: center; margin: 22px 0;">
        <span style="display: inline-block; background-color: #f1f5f9; border: 1px solid #bae6fd; border-radius: 20px; padding: 8px 20px; font-size: 12px; font-weight: 700; color: #0284c7; letter-spacing: 0.5px;">VOTOS DE FELICIDADES &amp; HARMONIA</span>
      </div>
      <p style="font-size: 15px; font-weight: 700; color: #0284c7; text-align: center;">Parabéns pelo seu dia!</p>
      <div style="margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #64748b;">Com as mais calorosas saudações,</p>
        ${assinaturaHtml}
        <p style="margin: 2px 0 0; font-size: 13px; font-weight: 700; color: #0b1426;">${nomeAdmin}</p>
        <p style="margin: 0; font-size: 12px; color: #64748b;">A Administração do ${nomeEdificio}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default {
  gerarHtmlAutoresponder,
  gerarHtmlResposta,
  gerarHtmlAniversario
};
