import { exigirSessaoValida, exigirSessaoComPapel } from "../server/lib/verificarSessao.js";

export default async function handler(req, res) {
  const { acao } = req.query;

  // "lancar" (submeter um comprovativo de pagamento) é uma ação do próprio
  // condómino — fica aberta a qualquer conta autenticada. "confirmar"
  // (validar um pagamento como recebido, marcando a dívida como paga),
  // "emitir-notas-atraso" (emissão retroativa de notas de cobrança ao
  // registar um proprietário) e "dividir-pagamento-meses" (confirmar um
  // pagamento único como várias mensalidades adiantadas) só podem ser
  // feitas por quem gere o condomínio: sem esta distinção, qualquer conta
  // autenticada conseguia confirmar como paga ou emitir cobranças de
  // qualquer fração/prédio.
  if (acao === "confirmar" || acao === "emitir-notas-atraso" || acao === "dividir-pagamento-meses" || acao === "desfazer-confirmacao" || acao === "recalcular-meses" || acao === "reconciliar-saldo") {
    const chamador = await exigirSessaoComPapel(req, res, ["ADMIN", "GESTOR", "EMPRESA_GESTORA"]);
    if (!chamador) return;
  } else {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
  }

  try {
    if (acao === "lancar") {
      const mod = await import("../api_handlers_backup/lancar-pagamento.js");
      return mod.default(req, res);
    }

    if (acao === "confirmar") {
      const mod = await import("../api_handlers_backup/confirmar-pagamento.js");
      return mod.default(req, res);
    }

    if (acao === "emitir-notas-atraso") {
      const mod = await import("../api_handlers_backup/emitir-notas-atraso.js");
      return mod.default(req, res);
    }

    if (acao === "dividir-pagamento-meses") {
      const mod = await import("../api_handlers_backup/dividir-pagamento-meses.js");
      return mod.default(req, res);
    }

    if (acao === "desfazer-confirmacao") {
      const mod = await import("../api_handlers_backup/desfazer-confirmacao-pagamento.js");
      return mod.default(req, res);
    }

    if (acao === "recalcular-meses") {
      const mod = await import("../api_handlers_backup/recalcular-meses-pagamento.js");
      return mod.default(req, res);
    }

    if (acao === "reconciliar-saldo") {
      const mod = await import("../api_handlers_backup/reconciliar-saldo-conta.js");
      return mod.default(req, res);
    }

    return res.status(400).json({
      ok: false,
      error: "Ação inválida. Use lancar | confirmar | emitir-notas-atraso | dividir-pagamento-meses | desfazer-confirmacao | recalcular-meses | reconciliar-saldo"
    });

  } catch (err) {
    console.error("Erro no pagamento.js:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no pagamento.js",
      detail: err?.message || String(err),
    });
  }
}
