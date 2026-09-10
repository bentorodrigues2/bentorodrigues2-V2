export function gerarHtmlFinal(categoria, mensagem, nome) {
  const imagens = {
    documentos: "/public/marcas/16-documentos-relatorios.png",
    quotas: "/public/modulos/57-quota.png",
    ruido: "/public/modulos/01-predio.png",
    avaria: "/public/modulos/71-email-de-avarias.png",
    assembleia: "/public/modulos/01-predio.png",
    seguro: "/public/modulos/15-documentos-da-fracao.png",
    informacao: "/public/modulos/15-documentos-da-fracao.png",
    urgencia: "/public/modulos/01-predio.png",
    inquilino: "/public/modulos/11-proprietario.png",
    coproprietario: "/public/modulos/11-proprietario.png",
    proprietario: "/public/modulos/11-proprietario.png",
  };

  return `
    <div style="max-width:650px;margin:0 auto;font-family:Arial, sans-serif;">
      
      <div style="text-align:center;margin-bottom:25px;">
        <img src="/public/marca/20-Logotipo Horizontal com fundo.png"
             alt="CondoManager AI"
             style="width:260px;opacity:0.95;" />
      </div>

      <p>Olá ${nome},</p>

      <p>${mensagem}</p>

      <div style="text-align:center;margin:25px 0;">
        <img src="${imagens[categoria]}" style="width:100%;max-width:650px;border-radius:8px;" />
      </div>

      <p>Caso necessite de documentação adicional, poderá solicitar através da aplicação móvel ou enviando email para bentorodrigues2@gmail.com.</p>

      <p>
        Com os meus cumprimentos,<br/>
        José Carlos Guerra<br/>
        Administração do Condomínio
      </p>

    </div>
  `;
}
