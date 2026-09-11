//
// 1) HTML DO AUTORESPONDER
// (email automático “Obrigado pelo seu contacto”)
//

export function gerarHtmlAutoresponder(nome) {

  return `
    <div style="max-width:650px;margin:0 auto;font-family:Arial, sans-serif;">

      <!-- Logotipo ao centro -->
      <div style="text-align:center;margin-bottom:25px;">
        <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
             alt="CondoManager AI"
             style="width:220px;opacity:0.95;" />
      </div>

      <p>Olá ${nome || "Condómino"},</p>

      <p>Agradecemos o seu contacto.</p>

      <!-- Imagem por baixo do texto -->
      <div style="text-align:center;margin:25px 0;">
        <img src="https://bentorodrigues2.vercel.app/email/20-email-opt.webp"
             alt="Email recebido"
             style="width:85%;max-width:480px;border-radius:8px;" />
      </div>

      <p>
        Caso necessite de alguma informação urgente poderá solicitar através da aplicação móvel enviando mensagem direta para a administração.
      </p>

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
// 2) HTML DA RESPOSTA INSTITUCIONAL (AI ROUTER / GROQ)
// (email formal com a resposta gerada pela IA)
//

export function gerarHtmlResposta(nome, mensagem) {

  return `
    <div style="max-width:650px;margin:0 auto;font-family:Arial, sans-serif;">

      <!-- Logotipo ao centro -->
      <div style="text-align:center;margin-bottom:25px;">
        <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
             alt="CondoManager AI"
             style="width:240px;opacity:0.95;" />
      </div>

      <p>Olá ${nome || "Condómino"},</p>

      <!-- Mensagem institucional do AI Router -->
      <p style="line-height:1.5;font-size:15px;">
        ${mensagem.replace(/\n/g, "<br>")}
      </p>

      <p style="margin-top:30px;">
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
