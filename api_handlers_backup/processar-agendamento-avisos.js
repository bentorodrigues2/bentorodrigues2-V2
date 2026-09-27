import { processarAgendamentosAvisos } from "../server/lib/cronService.js";

// Disparado pelo frontend (GestaoQuotasOrcamento.tsx) logo a seguir a criar
// um agendamento de envio com "Enviar Imediatamente" — processa só esse
// agendamento específico, de imediato, em vez de o administrador ter de
// esperar pelo próximo /api/cron diário para ver as notas de cobrança
// saírem. O mesmo agendamento também seria apanhado pelo cron mais tarde,
// mas fica marcado "Executado" aqui e não é reprocessado (idempotente).
// Protegido por sessão com papel ADMIN/GESTOR/EMPRESA_GESTORA em
// api/pagamento.js (ver acao === "processar-agendamento-avisos").
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Método não permitido" });
    }

    const { id_agendamento } = req.body || {};
    if (!id_agendamento) {
      return res.status(400).json({ ok: false, error: "id_agendamento é obrigatório" });
    }

    const resultado = await processarAgendamentosAvisos(id_agendamento);
    return res.status(200).json(resultado);
  } catch (err) {
    console.error("Erro em processar-agendamento-avisos.js:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
