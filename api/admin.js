import { emitirQuotasMensais, enviarLembretesQuotas, avisarQuotasEmMora, enviarFelicitacoesAniversario } from "../server/lib/cronService.js";

const JOBS = {
  EMISSAO_MENSAL_QUOTAS: emitirQuotasMensais,
  LEMBRETE_CORDIAL_VENCIMENTO: enviarLembretesQuotas,
  AVISO_MORA_INCUMPRIMENTO: avisarQuotasEmMora,
  FELICITACOES_ANIVERSARIO: enviarFelicitacoesAniversario
};

/**
 * Disparo manual, a partir da app, dos mesmos jobs que o /api/cron corre
 * automaticamente todos os dias (ver AgendadorAutomatico.tsx e
 * EnviosProgramados.tsx — "executar agora" / "forçar disparo"). Distinto de
 * /api/cron (que exige CRON_SECRET, por ser acionado por um worker externo);
 * este é só para o admin, já autenticado na app, forçar um job na hora.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { job } = req.body || {};
    const fn = JOBS[job];
    if (!fn) {
      return res.status(400).json({ error: `Job inválido. Use: ${Object.keys(JOBS).join(", ")}` });
    }

    const resultado = await fn();
    return res.status(200).json({ ok: true, ...resultado });
  } catch (err) {
    console.error("Erro em /api/admin (forçar job):", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
