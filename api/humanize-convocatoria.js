import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/humanize-convocatoria" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      tema,
      data,
      hora,
      horaSegunda,
      local,
      ordensTrabalho,
      isVideoconferencia,
      plataformaVideo,
      linkVideo,
      predio
    } = req.body || {};

    const prompt = `És um especialista em gestão de comunidades e comunicação para condomínios em Portugal.
A tua missão é reescrever a seguinte Convocatória de Assembleia de Condóminos com uma forte capacidade analítica e de uma forma profundamente HUMANA, calorosa, clara e envolvente, sem perder a validade e solenidade jurídica necessária (Código Civil Art. 1431.º e 1432.º).

DADOS DA CONVOCATÓRIA:
- Edifício: ${predio?.nome || "Condomínio"} (${predio?.morada_linha1 || ""}, ${predio?.localidade || ""})
- Tema: ${tema || "Assembleia Geral de Condóminos"}
- 1ª Convocatória: ${data || ""} às ${hora || ""} horas
- 2ª Convocatória (Código Civil): ${data || ""} às ${horaSegunda || "30 minutos depois"} horas
- Local: ${local || "Instalações do Condomínio"}
${isVideoconferencia ? `- Modalidade Mista / Vídeo: ${plataformaVideo || "Videoconferência"} com link ${linkVideo || ""}` : "- Modalidade: Presencial"}
- Ordem de Trabalhos Bruta:
${ordensTrabalho || "1. Contas; 2. Orçamento; 3. Assuntos Gerais."}

DIRETRIZES DE ESTILO E CAPACIDADE ANALÍTICA:
1. Linguagem Humana e Acolhedora: Fala para vizinhos e proprietários com empatia, transparência e respeito pelo tempo e património de cada um.
2. Capacidade Analítica: Para cada ponto da ordem de trabalhos, faz um breve enquadramento analítico explicando sucintamente PORQUE é importante a decisão para a valorização, segurança ou boa convivência no condomínio (ex.: aprovação de contas dá transparência; orçamentos preparam o edifício; obras garantem a durabilidade).
3. Facilidade de Participação: Reforça que a opinião de todos é essencial. Explica com simplicidade como quem não puder comparecer pessoalmente pode emitir procuração a outro condómino ou aceder online/PWA.
4. Menção às 1ª e 2ª Convocatórias clara e pedagógica (explicando porque existem as duas horas).
5. Sondagem de Presenças: Relembra amavelmente para assinalarem presenças para antecipar o quórum.
6. ASSINATURA OBRIGATÓRIA (sem menções comerciais ou marcas de terceiros):
Com os meus cumprimentos,

[Assinatura Digital]
 O Administrador do Condomínio

Devolve apenas o texto da convocatória pronto a enviar por email aos condóminos.`.trim();

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return res.status(200).json({ text: responseText, success: true });
  } catch (err) {
    console.error("Erro no /api/humanize-convocatoria:", err);
    return res.status(500).json({
      error: err?.message || "Erro ao humanizar convocatória com IA.",
      success: false
    });
  }
}
