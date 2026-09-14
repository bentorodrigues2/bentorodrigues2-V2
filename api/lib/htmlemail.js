/**
 * Utilitários para geração de templates HTML de emails institucionais
 */

export function gerarHtmlAutoresponder(nome = "Condómino") {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Recebemos o seu contacto</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
    <h2 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">Gestão de Condomínio</h2>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; padding: 28px; border-radius: 0 0 8px 8px; background-color: #ffffff;">
    <p style="font-size: 16px; margin-top: 0;">Olá <strong>${nome}</strong>,</p>
    <p>Confirmamos a receção da sua mensagem. O assunto foi registado no sistema central de gestão de condomínios e está a ser analisado pela equipa de administração.</p>
    <div style="background-color: #f1f5f9; border-left: 4px solid #0284c7; padding: 14px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; font-size: 14px; color: #334155;">
        <strong>Informação:</strong> Comprovativos de pagamento e participações de ocorrências são processados com prioridade. Se anexou documentos ou faturas, os registos serão validados em conformidade.
      </p>
    </div>
    <p style="margin-top: 28px; font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 16px;">
      Esta é uma notificação automática de confirmação de entrega.<br>
      <strong>Administração do Edifício</strong>
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
  <div style="background-color: #0f766e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
    <h2 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">Administração do Condomínio</h2>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; padding: 28px; border-radius: 0 0 8px 8px; background-color: #ffffff;">
    <p style="font-size: 16px; margin-top: 0;">Estimado(a) <strong>${nome}</strong>,</p>
    <div style="margin: 20px 0; padding: 18px; background-color: #f8fafc; border-left: 4px solid #0f766e; border-radius: 0 6px 6px 0; font-size: 15px;">
      ${mensagemFormatada}
    </div>
    <p style="margin-top: 28px; font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 16px;">
      Com os melhores cumprimentos,<br>
      <strong>Administração do Edifício</strong>
    </p>
  </div>
</body>
</html>`;
}

export default {
  gerarHtmlAutoresponder,
  gerarHtmlResposta
};
