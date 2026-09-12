export const config = { runtime: "edge" };
import { supabase } from "../../services/lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("estado", "confirmado")
      .order("confirmado_em", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ ok: true, confirmados: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

