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
 * pedido explícito: "não faz sentido enviarmos como anexo"). Reproduz na
 * íntegra o design do postal oficial (src/utils.ts,
 * gerarCartaoAniversarioCondominoPDF): moldura dupla, pontos decorativos nos
 * 4 cantos, imagem de fundo do bolo de aniversário, caixa de destinatário e
 * selo "VOTOS DE FELICIDADES & HARMONIA" — mas com as cores institucionais
 * CondoManager AI (Teal #0D9488, a mesma usada em "TOTAL DO RECIBO") em vez
 * do azul genérico (Sky Blue #0284C7) do desenho original. Inclui a
 * assinatura digital real do administrador quando existir
 * (predios.patrimonio.assinatura_admin_base64), com fallback para o nome.
 */
export function gerarHtmlAniversario({ nome, predioNome, adminNome, adminSignatureBase64 }) {
  const nomeDestinatario = nome || "Condómino(a)";
  const nomeEdificio = predioNome || "Condomínio";
  const nomeAdmin = adminNome || "A Administração do Condomínio";
  const corTeal = "#0D9488"; // cor institucional CondoManager AI (a mesma de "TOTAL DO RECIBO")
  const corNavy = "#0B1426";

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
  <div style="position: relative; border: 1.5px solid ${corNavy}; border-radius: 10px; padding: 5px; background-color: #ffffff;">
    <span style="position: absolute; top: 1px; left: 1px; width: 6px; height: 6px; border-radius: 50%; background-color: ${corTeal};"></span>
    <span style="position: absolute; top: 1px; right: 1px; width: 6px; height: 6px; border-radius: 50%; background-color: ${corTeal};"></span>
    <span style="position: absolute; bottom: 1px; left: 1px; width: 6px; height: 6px; border-radius: 50%; background-color: ${corTeal};"></span>
    <span style="position: absolute; bottom: 1px; right: 1px; width: 6px; height: 6px; border-radius: 50%; background-color: ${corTeal};"></span>

    <div style="border: 1px solid ${corTeal}; border-radius: 7px; padding: 26px 24px; background-image: url('https://bentorodrigues2.condomanagerai.com/email/birthday-watermark.jpg'); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: #ffffff;">
      <p style="margin: 0; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: ${corNavy};">${nomeEdificio.toUpperCase()}</p>

      <div style="text-align: center; margin: 8px 0 16px;">
        <span style="display: inline-block; width: 55px; height: 1px; background-color: ${corTeal}; vertical-align: middle;"></span>
        <span style="display: inline-block; width: 4px; height: 4px; border-radius: 50%; background-color: ${corTeal}; vertical-align: middle; margin: 0 5px;"></span>
        <span style="display: inline-block; width: 55px; height: 1px; background-color: ${corTeal}; vertical-align: middle;"></span>
      </div>

      <h1 style="margin: 0; text-align: center; font-size: 28px; color: ${corNavy};">FELIZ ANIVERSÁRIO!</h1>
      <p style="margin: 6px 0 20px; text-align: center; font-size: 11.5px; color: #475569;">Hoje é um dia de celebração muito especial para a nossa comunidade</p>

      <div style="background-color: #f0fdfa; border: 1px solid ${corTeal}; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 18px;">
        <p style="margin: 0; font-size: 15px; font-weight: 700; color: ${corNavy};">Exmo.(a) Sr.(a) ${nomeDestinatario},</p>
      </div>

      <p style="font-size: 13px; color: #1e293b; text-align: center; margin: 0 0 12px;">A Administração do condomínio <strong>${nomeEdificio}</strong> tem o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais junto de quem mais estima.</p>
      <p style="font-size: 13px; color: #1e293b; text-align: center; margin: 0 0 18px;">Agradecemos o seu contributo diário para a harmonia e bom convívio no nosso edifício.</p>

      <p style="text-align: center; font-size: 14.5px; font-weight: 700; color: ${corTeal}; margin: 0 0 18px;">Parabéns pelo seu dia!</p>

      <div style="text-align: center; margin-bottom: 20px;">
        <span style="display: inline-block; background-color: #f1f5f9; border: 1px solid #99f6e4; border-radius: 20px; padding: 8px 20px; font-size: 11px; font-weight: 700; color: ${corTeal}; letter-spacing: 0.5px;">VOTOS DE FELICIDADES &amp; HARMONIA</span>
      </div>

      <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #64748b;">Com as mais calorosas saudações,</p>
        ${assinaturaHtml}
        <p style="margin: 2px 0 0; font-size: 13px; font-weight: 700; color: ${corNavy};">${nomeAdmin}</p>
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
