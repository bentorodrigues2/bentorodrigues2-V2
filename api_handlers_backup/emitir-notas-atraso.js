import { emitirNotasEmAtrasoFracao } from "../server/lib/cronService.js";

// Disparado pelo frontend (GestaoFracoes.tsx) logo que um proprietário é
// registado pela primeira vez numa fração — emite retroativamente todas as
// notas de cobrança mensais em falta desde o início de atividade da
// administração (01/06/2026, por omissão) até ao mês corrente, para essa
// fração. Protegido por sessão com papel ADMIN/GESTOR/EMPRESA_GESTORA em
// api/pagamento.js (ver acao === "emitir-notas-atraso").
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Método não permitido" });
    }

    const { id_predio, id_fracao, mes_inicio } = req.body || {};
    if (!id_predio || !id_fracao) {
      return res.status(400).json({ ok: false, error: "id_predio e id_fracao são obrigatórios" });
    }

    const resultado = await emitirNotasEmAtrasoFracao(id_predio, id_fracao, mes_inicio || "2026-06-01");
    if (!resultado.ok) {
      return res.status(400).json(resultado);
    }

    return res.status(200).json(resultado);
  } catch (err) {
    console.error("Erro em emitir-notas-atraso.js:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
