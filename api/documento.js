import { supabase } from "../server/lib/supabaseServer.js";
import { enviarEmailPDF } from "../server/lib/pdfService.js";
import { arquivarAnexoOriginal } from "../server/lib/multimodalService.js";
import { exigirSessaoValida } from "../server/lib/verificarSessao.js";

/**
 * Reenvia por email um documento já arquivado no Supabase Storage (Arquivo
 * Digital) — usado pelo botão "Enviar por Email" em GestaoDocumentos.tsx,
 * que antes só mostrava uma animação de sucesso sem nunca enviar nada.
 */
async function enviarDocumentoExistente({ caminho, nomeFicheiro, to, assunto, mensagem, nomeDestinatario, cc }) {
  const { data, error } = await supabase.storage.from("documentos").download(caminho);
  if (error || !data) {
    throw new Error(error?.message || "Documento não encontrado no arquivo");
  }

  const arrayBuffer = await data.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  await enviarEmailPDF({
    to,
    nomeDestinatario,
    assunto,
    mensagem,
    pdfBuffer,
    nome: nomeFicheiro,
    cc
  });
}

export default async function handler(req, res) {
  const acao = req.query?.acao;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const utilizador = await exigirSessaoValida(req, res);
  if (!utilizador) return;

  try {
    const body = req.body || {};

    // Devolve um URL temporário assinado para o ficheiro real já arquivado
    // no Storage — usado pelo botão "Descarregar" do Arquivo Digital, que
    // antes nunca ia buscar o ficheiro real e regenerava sempre um PDF novo
    // a partir de padrões no nome/categoria (para recibos, chegava a mostrar
    // dados fictícios de uma pessoa diferente da do documento clicado).
    if (acao === "descarregar") {
      const { caminho } = body;
      if (!caminho) {
        return res.status(400).json({ error: "caminho é obrigatório" });
      }

      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(caminho, 300);
      if (error || !data?.signedUrl) {
        return res.status(404).json({ error: error?.message || "Documento não encontrado no arquivo" });
      }

      return res.status(200).json({ ok: true, url: data.signedUrl });
    }

    if (acao === "enviar") {
      const { caminho, nome, email, assunto, mensagem, nomeDestinatario, cc } = body;
      if (!caminho || !email) {
        return res.status(400).json({ error: "caminho e email são obrigatórios" });
      }

      await enviarDocumentoExistente({
        caminho,
        nomeFicheiro: nome || caminho.split("/").pop(),
        to: email,
        assunto: assunto || `Documento: ${nome || "Documento"}`,
        mensagem: mensagem || `Segue em anexo o documento solicitado.`,
        nomeDestinatario,
        cc
      });

      return res.status(200).json({ ok: true, email_enviado: true });
    }

    // Anexa um ficheiro digitalizado (foto/PDF) ao Arquivo Digital — usado
    // para juntar a uma ata a folha de assinaturas assinada em papel, para
    // quem preferir assinar fisicamente em vez de assinatura digital no ecrã.
    if (acao === "anexar") {
      const { fileBase64, fileName, mimeType, predio, ano, tema, tipo, fluxo, descricao, categoria } = body;
      if (!fileBase64 || !fileName) {
        return res.status(400).json({ error: "fileBase64 e fileName são obrigatórios" });
      }

      const buffer = Buffer.from(fileBase64, "base64");
      const caminho = await arquivarAnexoOriginal({
        buffer,
        filename: fileName,
        mimeType: mimeType || "application/octet-stream",
        ano: ano || new Date().getFullYear(),
        tema: tema || "Assembleias",
        tipo: tipo || "Anexo",
        predio: predio || "geral",
        fracao: "geral",
        fluxo: fluxo || "anexo_manual",
        origem: "upload_admin",
        categoria: categoria || undefined,
        visibilidade: "Público",
        descricao
      });

      return res.status(200).json({ ok: true, caminho });
    }

    return res.status(400).json({ error: "Ação inválida. Use acao=descarregar|enviar|anexar" });
  } catch (err) {
    console.error("Erro em /api/documento:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
