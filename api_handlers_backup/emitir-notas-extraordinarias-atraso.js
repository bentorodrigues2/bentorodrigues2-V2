import { emitirNotasExtraordinariasEmAtraso } from "../server/lib/cronService.js";

// Disparado manualmente pelo frontend (botão "Emitir Notas em Atraso" em
// GestaoQuotasOrcamento.tsx, secção 2.2 Quota Extraordinária) — varre TODAS
// as prestações de Quota Extraordinária de todos os prédios cujo vencimento
// já chegou/passou, ainda "Pendente", e que nunca tiveram a nota de cobrança
// emitida (idempotente por aviso, ver emitirNotasExtraordinariasEmAtraso em
// cronService.js). O mesmo job também corre automaticamente todos os dias
// via /api/cron — este botão existe só para não obrigar a esperar pelo cron
// seguinte depois de configurar uma Quota Extraordinária com data de início
// já no passado. Protegido por sessão com papel ADMIN/GESTOR/EMPRESA_GESTORA
// em api/pagamento.js (ver acao === "emitir-notas-extraordinarias-atraso").
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Método não permitido" });
    }

    const resultado = await emitirNotasExtraordinariasEmAtraso();
    return res.status(200).json(resultado);
  } catch (err) {
    console.error("Erro em emitir-notas-extraordinarias-atraso.js:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
