import { emitirQuotasMensais, enviarLembretesQuotas, avisarQuotasEmMora, enviarFelicitacoesAniversario } from "../server/lib/cronService.js";

/**
 * Endpoint diário de automações agendadas — chamado por um cron externo
 * (Cloudflare Worker, o mesmo mecanismo já usado para o gmail-cron), uma vez
 * por dia. Decide sozinho, pela data de hoje, quais dos 4 jobs deve correr:
 *   - dia 25: emissão da nota de cobrança do mês seguinte
 *   - dia 5:  lembrete a quem ainda não pagou a quota do mês a decorrer
 *   - dia 16: aviso de mora a quem continua sem pagar
 *   - todos os dias: felicitações de aniversário
 * Protegido por um segredo partilhado (?secret= ou header x-cron-secret),
 * para não poder ser invocado por terceiros.
 */
export default async function handler(req, res) {
  try {
    const secretEsperado = process.env.CRON_SECRET;
    const authHeader = req.headers["authorization"];
    const secretRecebido =
      req.query?.secret ||
      req.headers["x-cron-secret"] ||
      (authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

    // Sem CRON_SECRET configurado, o endpoint fica fechado por omissão (nunca aberto ao público).
    if (!secretEsperado || secretRecebido !== secretEsperado) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const hoje = new Date();
    const dia = hoje.getUTCDate(); // o cron externo deve correr a uma hora UTC fixa, ver instruções de deploy
    const forcar = req.query?.forcar; // para testes manuais: ?forcar=emissao|lembrete|mora|aniversario

    const resultados = [];

    if (forcar === "aniversario" || (!forcar && true)) {
      resultados.push(await enviarFelicitacoesAniversario());
    }

    if (forcar === "emissao" || (!forcar && dia === 25)) {
      resultados.push(await emitirQuotasMensais());
    }

    if (forcar === "lembrete" || (!forcar && dia === 5)) {
      resultados.push(await enviarLembretesQuotas());
    }

    if (forcar === "mora" || (!forcar && dia === 16)) {
      resultados.push(await avisarQuotasEmMora());
    }

    return res.status(200).json({ status: "ok", data: hoje.toISOString().split("T")[0], jobs_executados: resultados });
  } catch (e) {
    console.error("Erro em /api/cron:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
