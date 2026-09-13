import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function gerarPDF(conteudo: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: conteudo }]
      }
    ],
    generationConfig: { mimeType: "application/pdf" }
  });

  const pdfData = result.response.candidates[0].content.parts[0].inlineData.data;
  return Buffer.from(pdfData, "base64");
}
