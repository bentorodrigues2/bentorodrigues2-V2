import { supabase } from "../server/lib/supabaseServer.js";
import { enviarEmailPDF } from "../server/lib/pdfService.js";

/**
 * Reenvia por email um documento já arquivado no Supabase Storage (Arquivo
 * Digital) — usado pelo botão "Enviar por Email" em GestaoDocumentos.tsx,
 * que antes só mostrava uma animação de sucesso sem nunca enviar nada.
 */
async function enviarDocumentoExistente({ caminho, nomeFicheiro, to, assunto, mensagem, nomeDestinatario }) {
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
    nome: nomeFicheiro
  });
}

export default async function handler(req, res) {
  const acao = req.query?.acao;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const body = req.body || {};

    if (acao === "enviar") {
      const { caminho, nome, email, assunto, mensagem, nomeDestinatario } = body;
      if (!caminho || !email) {
        return res.status(400).json({ error: "caminho e email são obrigatórios" });
      }

      await enviarDocumentoExistente({
        caminho,
        nomeFicheiro: nome || caminho.split("/").pop(),
        to: email,
        assunto: assunto || `Documento: ${nome || "Documento"}`,
        mensagem: mensagem || `Segue em anexo o documento solicitado.`,
        nomeDestinatario
      });

      return res.status(200).json({ ok: true, email_enviado: true });
    }

    return res.status(400).json({ error: "Ação inválida. Use acao=enviar" });
  } catch (err) {
    console.error("Erro em /api/documento:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
