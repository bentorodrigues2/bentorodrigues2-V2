export default async function handler(req, res) {
  try {
    const { texto } = req.body;

    if (!texto || typeof texto !== "string") {
      return res.status(400).json({ error: "Texto inválido para classificação" });
    }

    const lower = texto.toLowerCase();

    let categoria = "geral";

    // --- COMPROVATIVOS / PAGAMENTOS ENVIADOS / EXTRATOS ---
    if (
      lower.includes("comprovativo") ||
      lower.includes("comprovativos") ||
      lower.includes("transferência") ||
      lower.includes("transferencia") ||
      lower.includes("mbway") ||
      lower.includes("recibo") ||
      lower.includes("paguei") ||
      lower.includes("pagamento enviado") ||
      lower.includes("envio de comprovativo") ||
      lower.includes("extrato") ||
      lower.includes("extrato bancário") ||
      lower.includes("extrato bancario") ||
      lower.includes("movimentos bancários") ||
      lower.includes("movimentos bancarios")
    ) {
      categoria = "comprovativo";
    }

    // --- FATURAS DE FORNECEDORES ---
    else if (
      lower.includes("fatura") ||
      lower.includes("faturas") ||
      lower.includes("fatura fornecedor") ||
      lower.includes("faturas fornecedor") ||
      lower.includes("fornecedor") ||
      lower.includes("prestador") ||
      lower.includes("serviço") ||
      lower.includes("servicos") ||
      lower.includes("nota de débito") ||
      lower.includes("nota de debito")
    ) {
      categoria = "faturas";
    }

    // --- ORÇAMENTOS / PROPOSTAS / COTAÇÕES ---
    else if (
      lower.includes("orçamento") ||
      lower.includes("orcamento") ||
      lower.includes("orçamentos") ||
      lower.includes("orcamentos") ||
      lower.includes("proposta") ||
      lower.includes("propostas") ||
      lower.includes("cotação") ||
      lower.includes("cotacao")
    ) {
      categoria = "orcamentos";
    }

    // --- ASSEMBLEIA / ATA ---
    else if (
      lower.includes("ata") ||
      lower.includes("assembleia") ||
      lower.includes("reunião") ||
      lower.includes("reuniao")
    ) {
      categoria = "assembleia";
    }

    // --- QUOTAS / PAGAMENTOS ---
    else if (
      lower.includes("quota") ||
      lower.includes("quotas") ||
      lower.includes("pagamento") ||
      lower.includes("mensalidade") ||
      lower.includes("valor em dívida") ||
      lower.includes("valor em divida") ||
      lower.includes("dívida") ||
      lower.includes("divida")
    ) {
      categoria = "pagamentos";
    }

    // --- RUÍDO ---
    else if (
      lower.includes("ruído") ||
      lower.includes("ruido") ||
      lower.includes("barulho") ||
      lower.includes("barulhos") ||
      lower.includes("vizinho") ||
      lower.includes("vizinhos")
    ) {
      categoria = "ruido";
    }

    // --- AVARIAS ---
    else if (
      lower.includes("avaria") ||
      lower.includes("avarias") ||
      lower.includes("reparação") ||
      lower.includes("reparacao") ||
      lower.includes("estragado") ||
      lower.includes("partido") ||
      lower.includes("não funciona") ||
      lower.includes("nao funciona")
    ) {
      categoria = "avarias";
    }

    return res.status(200).json({ categoria });

  } catch (err) {
    console.error("Erro no classificador:", err);
    return res.status(500).json({ error: "Erro no classificador" });
  }
}
