export default async function handler(req, res) {
  try {
    const { texto } = req.body;

    if (!texto || typeof texto !== "string") {
      return res.status(400).json({ error: "Texto inválido para classificação" });
    }

    const lower = texto.toLowerCase();

    let categoria = null;

    // Regras de classificação (podes ajustar)
    if (lower.includes("ata") || lower.includes("assembleia")) {
      categoria = "assembleia";
    } 
    else if (lower.includes("quota") || lower.includes("pagamento")) {
      categoria = "pagamentos";
    }
    else if (lower.includes("ruído") || lower.includes("barulho")) {
      categoria = "ruido";
    }
    else if (lower.includes("avaria") || lower.includes("reparação")) {
      categoria = "avarias";
    }
    else {
      categoria = "geral";
    }

    return res.status(200).json({ categoria });

  } catch (err) {
    console.error("Erro no classificador:", err);
    return res.status(500).json({ error: "Erro no classificador" });
  }
}
