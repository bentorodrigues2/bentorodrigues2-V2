export function gerarHtmlFinal(nome) {

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

      <p>Caso necessite de esclarecimentos adicionais poderá solicitar através da aplicação móvel enviando mensagem direta para a administração.</p>

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
