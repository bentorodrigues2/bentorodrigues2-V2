import { supabase } from "../server/lib/supabaseServer.js";
import { gerarDocumentoPDF } from "../server/lib/pdfService.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { id_pagamento } = req.body || {};
    if (!id_pagamento) {
      return res.status(400).json({ error: "id_pagamento em falta" });
    }

    // 1) Confirmar pagamento
    const { data: pagamento, error: errPag } = await supabase
      .from("pagamentos")
      .update({ estado: "confirmado", confirmado_em: new Date().toISOString() })
      .eq("id", id_pagamento)
      .select()
      .single();

    if (errPag || !pagamento) {
      return res.status(404).json({ error: "Pagamento não encontrado", detail: errPag?.message });
    }

    // 2) Buscar proprietário e fração separadamente (sem depender de relações
    // embutidas do PostgREST, que exigem FKs registadas na cache do schema)
    const [{ data: proprietario }, { data: fracao }] = await Promise.all([
      pagamento.id_proprietario
        ? supabase.from("proprietarios").select("nome, email").eq("id_proprietario", pagamento.id_proprietario).maybeSingle()
        : Promise.resolve({ data: null }),
      pagamento.id_fracao
        ? supabase.from("fracoes").select("fracao_nome, id_predio").eq("id_fracao", pagamento.id_fracao).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const nomeDestinatario = proprietario?.nome || pagamento.entidade || "Condómino(a)";
    const emailDestinatario = proprietario?.email || null;
    const fracaoNome = fracao?.fracao_nome || pagamento.fracao || "Fração";
    const ano = new Date(pagamento.data_pagamento || pagamento.criado_em || Date.now()).getFullYear();

    const conteudoRecibo = `RECIBO DE PAGAMENTO

Exmo(a). Sr(a). ${nomeDestinatario},

Confirmamos a receção do pagamento referente à fração ${fracaoNome}.

Valor: ${Number(pagamento.valor || 0).toFixed(2)} EUR
Data: ${pagamento.data_pagamento || new Date().toISOString().split("T")[0]}
Referência: ${pagamento.referencia || pagamento.id}

Este documento serve de comprovativo de quitação do valor acima indicado.

Com os melhores cumprimentos,
A administração do condomínio`;

    // 3) Gerar o PDF do recibo, arquivar e enviar por email (tudo numa só chamada)
    const resultado = await gerarDocumentoPDF({
      conteudo: conteudoRecibo,
      ano,
      tema: "Financeiro",
      tipo: "Recibo",
      predio: fracao?.id_predio || null,
      fracao: pagamento.id_fracao || null,
      fluxo: "recibo_pos_confirmacao",
      emailDestino: emailDestinatario,
      nomeFicheiro: `recibo_${pagamento.id}.pdf`
    });

    return res.status(200).json({
      status: "ok",
      pagamento_confirmado: pagamento.id,
      recibo_caminho: resultado.caminho,
      email_enviado: Boolean(emailDestinatario)
    });
  } catch (e) {
    console.error("Erro em confirmar-pagamento:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
