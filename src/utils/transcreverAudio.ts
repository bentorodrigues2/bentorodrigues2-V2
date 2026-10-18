/**
 * Transcreve uma nota de voz por IA (/api/ai?acao=transcrever-audio) —
 * pedido explícito: plataforma inclusiva, dá a quem é surdo ou tem
 * dificuldade auditiva uma alternativa em texto a uma nota de voz, sem
 * depender de a conseguir ouvir. Falha em silêncio (devolve undefined) —
 * nunca deve impedir o envio da própria mensagem/áudio se a IA falhar.
 */
export async function transcreverAudio(blob: Blob): Promise<string | undefined> {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const resp = await fetch("/api/ai?acao=transcrever-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mimeType: blob.type || "audio/webm" })
    });
    const resultado = await resp.json();
    if (resp.ok && resultado?.ok && resultado.texto) return resultado.texto;
    return undefined;
  } catch (err) {
    console.warn("[transcreverAudio] Aviso: não foi possível transcrever a nota de voz:", err);
    return undefined;
  }
}
