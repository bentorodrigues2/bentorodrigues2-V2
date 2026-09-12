import { supabase } from "../../services/lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("id_fracao, valor, referencia");

    if (error) throw error;

    const mapa = {};

    data.forEach(p => {
      const key = ${p.id_fracao}-;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(p);
    });

    const resultado = Object.values(mapa).filter(x => x.length > 1);

    return res.status(200).json({ ok: true, duplicados: resultado });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
