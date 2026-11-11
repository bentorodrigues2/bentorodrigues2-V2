/**
 * Regista um acesso real a um documento (download, envio por email ou
 * leitura por OCR) na tabela imutável auditoria_plataforma (só
 * select/insert — ver api/data.js), para o painel "Logs Acesso a
 * Documentos" (SecurityAuditModal.tsx) deixar de estar sempre vazio.
 *
 * Causa raiz confirmada: existia desde sempre um motor completo de
 * ACL/RGPD para documentos (src/lib/documentSecurity.ts — matriz de
 * permissões por role, tipos de documento, logDocumentAccess) mas
 * logDocumentAccess() nunca era chamado em lado nenhum do código — nem um
 * único ponto real de download, envio ou OCR o invocava. O painel de
 * segurança mostrava sempre "Sem registos de acesso a documentos
 * gravados", não porque não houvesse acessos, mas porque nada os
 * registava. Em vez de tentar ligar este registo a cada botão de
 * download/OCR espalhado por dezenas de componentes, regista-se aqui, no
 * próprio servidor, nos dois sítios por onde TODOS esses acessos reais
 * passam sempre: /api/pdf (descarregar/enviar) e /api/ai (cada
 * ?acao=reconhecer-*).
 */
export async function registarAcessoDocumento(supabase, { email, acao, caminho, detalhes, idPredio }) {
  try {
    await supabase.from("auditoria_plataforma").insert({
      id: `doclog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_predio: idPredio || null,
      seccao: "Segurança Documental (RGPD)",
      descricao: `[${acao}] ${caminho || "documento"}`,
      detalhes: detalhes || null,
      email_usuario: email || null,
      origem: "web"
    });
  } catch (err) {
    console.warn("[documentAccessLog] Falha ao registar acesso a documento (não bloqueia a operação real):", err?.message || err);
  }
}
