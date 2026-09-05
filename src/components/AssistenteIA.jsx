import { useState } from "react";

export default function AssistenteIA() {
  const [prompt, setPrompt] = useState("");
  const [resposta, setResposta] = useState("");
  const [loading, setLoading] = useState(false);

  async function enviarIA() {
    setLoading(true);
    setResposta("");

    try {
      const response = await fetch("https://bentorodrigues2.onrender.com/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();
      setResposta(data.text || "Sem resposta da IA.");
    } catch (error) {
      setResposta("Erro ao contactar a IA.");
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Assistente IA</h2>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Escreve aqui a tua pergunta para a IA..."
        rows={5}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <button onClick={enviarIA} disabled={loading}>
        {loading ? "A pensar..." : "Perguntar à IA"}
      </button>

      {resposta && (
        <div style={{ marginTop: "20px", background: "#f0f0f0", padding: "10px" }}>
          <strong>Resposta da IA:</strong>
          <p>{resposta}</p>
        </div>
      )}
    </div>
  );
}
