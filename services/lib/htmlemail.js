//
// HTML DO AUTORESPONDER
// (email automático “Obrigado pelo seu contacto”)
//

export function gerarHtmlAutoresponder(nome) {

  // Garantir que o nome nunca é undefined, null ou vazio
  const nomeSeguro = String(nome || "Condómino");

  return `
    <div style="max-width:650px;margin:0 auto;font-family:Arial, sans-serif;">

      <!-- Logotipo ao centro -->
      <div style="text-align:center;margin-bottom:25px;">
        <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
             alt="Condomínio"
             style="width:240px;opacity:0.95;" />
      </div>

      <p>Olá ${nomeSeguro},</p>

      <p>Agradecemos o seu contacto.</p>

      <!-- Imagem ilustrativa -->
      <div style="text-align:center;margin:25px 0;">
        <img src="https://bentorodrigues2.vercel.app/email/20-email-opt.webp"
             alt="Email recebido"
             style="width:85%;max-width:480px;border-radius:8px;" />
      </div>

      <p>
        Caso necessite de alguma informação urgente poderá utilizar a aplicação móvel e enviar mensagem direta para a administração.
      </p>

      <br>

      <p>
        Com os meus cumprimentos,<br/>
        A administração do condomínio<br/>
        <strong>José Carlos Guerra</strong><br/>
        📞 +351 919 943 465<br/>
        <span style="color:#0a8a0a; font-weight:bold;">
          ✉️ bentorodrgues2@gmail.com
        </span>
      </p>

    </div>
  `;
}



//
// HTML DA RESPOSTA INSTITUCIONAL (AI ROUTER / GEMINI)
//

export function gerarHtmlResposta(nome, mensagem) {

  // Nome e mensagem sempre seguros
  const nomeSeguro = String(nome || "Condómino");
  const mensagemSegura = String(mensagem || "").replace(/\n/g, "<br>");

  return `
    <div style="max-width:650px;margin:0 auto;font-family:Arial, sans-serif;">

      <!-- Logotipo ao centro -->
      <div style="text-align:center;margin-bottom:25px;">
        <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
             alt="Condomínio"
             style="width:240px;opacity:0.95;" />
      </div>

      <p>Olá ${nomeSeguro},</p>

      <!-- Mensagem institucional do AI Router -->
      <p style="line-height:1.6;font-size:15px;">
        ${mensagemSegura}
      </p>

      <br>

      <p>
        Com os meus cumprimentos,<br/>
        A administração do condomínio<br/>
        <strong>José Carlos Guerra</strong><br/>
        📞 +351 919 943 465<br/>
        <span style="color:#0a8a0a; font-weight:bold;">
          ✉️ bentorodrgues2@gmail.com
        </span>
      </p>

    </div>
  `;
}
