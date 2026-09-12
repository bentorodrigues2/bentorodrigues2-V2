import { supabase } from "../services/lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    const { tipo, fracao, proprietario } = req.query;

    // ============================
    // 1) CONFIRMADOS
    // ============================
    if (tipo === "confirmados") {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("estado", "confirmado");

      if (error) throw error;
      return res.status(200).json({ ok: true, confirmados: data });
    }

    // ============================
    // 2) ATRASADOS
    // ============================
    if (tipo === "atrasados") {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("estado", "atrasado");

      if (error) throw error;
      return res.status(200).json({ ok: true, atrasados: data });
    }

    // ============================
    // 3) DUPLICADOS
    // ============================
    if (tipo === "duplicados") {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id_fracao, valor, referencia");

      if (error) throw error;

      const mapa = {};

      data.forEach(p => {
        const key = `${p.id_fracao}-${p.valor}`;
        if (!mapa[key]) mapa[key] = [];
        mapa[key].push(p);
      });

      const duplicados = Object.values(mapa).filter(x => x.length > 1);

      return res.status(200).json({ ok: true, duplicados });
    }

    // ============================
    // 4) POR FRAÇÃO
    // ============================
    if (fracao) {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("id_fracao", fracao);

      if (error) throw error;
      return res.status(200).json({ ok: true, fracao, pagamentos: data });
    }

    // ============================
    // 5) POR PROPRIETÁRIO
    // ============================
    if (proprietario) {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("id_proprietario", proprietario);

      if (error) throw error;
      return res.status(200).json({ ok: true, proprietario, pagamentos: data });
    }

    // ============================
    // 6) SEM PARÂMETROS
    // ============================
    return res.status(400).json({
      ok: false,
      error: "Parâmetros inválidos. Use tipo=confirmados|atrasados|duplicados ou fracao=ID ou proprietario=ID"
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
