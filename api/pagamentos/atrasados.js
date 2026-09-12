import { supabase } from "../../services/lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("estado", "pendente")
      .lt("criado_em", limite);

    if (error) throw error;

    return res.status(200).json({ ok: true, atrasados: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
