
export default async function handler(req, res) {
  try {
    const { texto } = req.body;

    const resposta = await fetch(process.env.AI_STUDIO_MODEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_STUDIO_API_KEY}`,
      },
      body: JSON.stringify({ texto }),
    });

    const data = await resposta.json();

    return res.status(200).json({
      categoria: data?.categoria || null
    });

  } catch (err) {
    console.error("Erro no classificador:", err);
    return res.status(500).json({ error: "Erro no classificador" });
  }
}


