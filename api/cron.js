import { emitirQuotasMensais, emitirNotasEmAtrasoFracao, enviarLembretesQuotas, avisarQuotasEmMora, enviarFelicitacoesAniversario, sincronizarOrcamentosVigentes, processarContratosFornecedores, arquivarConversasAntigas, enviarNotasCorrecaoNovaQuota } from "../server/lib/cronService.js";

// Ação pontual (agendada para 2026-09-20 09:00 Lisboa, ver vercel.json —
// "0 8 20 9 *", só volta a coincidir com esta data daqui a um ano) pedida
// pelo administrador em 2026-09-20: emitir e enviar as notas de cobrança de
// 06,07,08,09/2026 aos 4 proprietários já registados com notificação
// "Digital" ativa (exclui a Fração I, que tem notificação "Correio Postal").
// Idempotente (emitirNotasEmAtrasoFracao salta meses já emitidos), por isso
// é seguro este cron continuar agendado — depois de emitido uma vez, não
// volta a enviar nada.
const ID_PREDIO_NOTAS_ATRASO_REGISTADOS = "predio-1789667520765";
const FRACOES_NOTAS_ATRASO_REGISTADOS = [
  "frac-1789782586308", // F - Sofia Alexandra Santos de Moura
  "frac-1789688162288", // K - José Carlos Alves Guerra
  "frac-1789782720970", // M - Ana Lúcia Lino Pires Pombo de Sousa
  "frac-1789782821245"  // P - CARLOS MANUEL DA FONSECA MADUREIRA
];

async function emitirNotasAtrasoRegistados() {
  const resultados = [];
  for (const id_fracao of FRACOES_NOTAS_ATRASO_REGISTADOS) {
    try {
      resultados.push(await emitirNotasEmAtrasoFracao(ID_PREDIO_NOTAS_ATRASO_REGISTADOS, id_fracao, "2026-06-01"));
    } catch (err) {
      resultados.push({ ok: false, id_fracao, error: err?.message || String(err) });
    }
  }
  return { job: "emitirNotasAtrasoRegistados", resultados };
}

/**
 * Endpoint diário de automações agendadas — chamado por um cron externo
 * (Cloudflare Worker, o mesmo mecanismo já usado para o gmail-cron), uma vez
 * por dia. Decide sozinho, pela data de hoje, quais dos jobs deve correr:
 *   - dia 25: emissão da nota de cobrança do mês seguinte
 *   - dia 5:  lembrete a quem ainda não pagou a quota do mês a decorrer
 *   - dia 16: aviso de mora a quem continua sem pagar
 *   - todos os dias: felicitações de aniversário
 *   - todos os dias: aplica adendas ao orçamento cuja data de vigência já chegou
 *   - todos os dias: renova/expira contratos de fornecedores e envia alertas de fim de contrato
 *   - todos os dias: arquiva conversas de mensagens sem atividade há mais de 7 dias
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

    // Corre sempre, todos os dias, antes da emissão do dia 25 — é esta
    // sincronização que faz uma adenda ao orçamento agendada para uma data
    // futura entrar em vigor sozinha, sem ação manual do administrador.
    if (forcar === "orcamentos" || (!forcar && true)) {
      resultados.push(await sincronizarOrcamentosVigentes());
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

    if (forcar === "contratos" || (!forcar && true)) {
      resultados.push(await processarContratosFornecedores());
    }

    // Todos os dias: arquiva conversas de mensagens sem atividade há mais
    // de 7 dias para o Arquivo Digital (Mensagens, por ano/fração).
    if (forcar === "arquivar-mensagens" || (!forcar && true)) {
      resultados.push(await arquivarConversasAntigas());
    }

    // Ação pontual agendada — ver comentário junto de emitirNotasAtrasoRegistados.
    if (forcar === "notas-atraso-registados") {
      resultados.push(await emitirNotasAtrasoRegistados());
    }

    // Ação pontual agendada para 2026-09-26 08:30 Lisboa (ver vercel.json —
    // "30 7 26 9 *") pedida pelo administrador: envia a nota de cobrança
    // corrigida de outubro/2026, já com o valor da nova quotização, a quem
    // ainda não a pagou. Idempotente (jaExecutadoHoje em
    // enviarNotasCorrecaoNovaQuota), seguro manter agendado.
    if (forcar === "correcao-nova-quota") {
      resultados.push(await enviarNotasCorrecaoNovaQuota(ID_PREDIO_NOTAS_ATRASO_REGISTADOS, "2026-10-08"));
    }

    return res.status(200).json({ status: "ok", data: hoje.toISOString().split("T")[0], jobs_executados: resultados });
  } catch (e) {
    console.error("Erro em /api/cron:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
