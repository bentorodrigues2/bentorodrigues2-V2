import { google } from "googleapis";
import { processInboundEmail } from "../server/lib/inboundProcessor.js";
import { supabase } from "../server/lib/supabaseServer.js";

// Normaliza o base64 devolvido pela API do Gmail (URL-safe: "-" e "_" em vez
// de "+" e "/", RFC 4648 §5) para base64 padrão, antes de o decodificar —
// sem isto, alguns anexos podiam ficar corrompidos silenciosamente.
function base64UrlParaPadrao(str) {
  return (str || "").replace(/-/g, "+").replace(/_/g, "/");
}

// O corpo de um email do Gmail raramente é uma lista plana de partes — é
// normal vir aninhado (ex: multipart/mixed > multipart/alternative >
// text/plain + text/html, com o anexo como irmão do multipart/alternative,
// não do text/plain). Um "payload.parts.forEach" de um só nível nunca
// encontrava anexos aninhados destas estruturas (o caso comum de emails
// reencaminhados, faturas eletrónicas, etc.) — por isso faturas como as da
// Nowo nunca tinham o seu anexo reconhecido. Achata a árvore toda primeiro.
function achatarPartesGmail(parts, acumulador = []) {
  for (const part of parts || []) {
    acumulador.push(part);
    if (part.parts?.length) {
      achatarPartesGmail(part.parts, acumulador);
    }
  }
  return acumulador;
}

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Buscar emails não lidos
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 10
    });

    const messages = list?.data?.messages || [];
    const emails = [];

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id
      });

      const payload = full?.data?.payload || {};
      const headers = payload.headers || [];

      const from = headers.find(h => h.name === "From")?.value || "";
      const subject = headers.find(h => h.name === "Subject")?.value || "";

      // Corpo do email (própria mensagem pode já não ter "parts" nenhuma —
      // um email simples de texto único vem direto em payload.body).
      const todasAsPartes = payload.parts ? achatarPartesGmail(payload.parts) : [];

      let body = "";
      const partePlana = todasAsPartes.find(p => p.mimeType === "text/plain");
      if (partePlana?.body?.data) {
        body = Buffer.from(base64UrlParaPadrao(partePlana.body.data), "base64").toString("utf8");
      } else if (!payload.parts && payload.body?.data) {
        body = Buffer.from(base64UrlParaPadrao(payload.body.data), "base64").toString("utf8");
      }

      // Extrair anexos — em qualquer profundidade da árvore MIME.
      const anexos = [];

      for (const part of todasAsPartes) {
        if (part.filename && part.body?.attachmentId) {
          const attachment = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: msg.id,
            id: part.body.attachmentId
          });

          anexos.push({
            filename: part.filename,
            mimeType: part.mimeType,
            base64: base64UrlParaPadrao(attachment.data.data)
          });
        }
      }

      emails.push({
        from,
        subject,
        body,
        anexos
      });

      // Processa o email diretamente aqui (em vez de depender de um sistema
      // externo reencaminhar corretamente para /api/ai-studio?acao=inbound
      // com os anexos incluídos) — confirmado em produção que esse
      // reencaminhamento nunca incluía o campo "anexos", por isso nenhum
      // email lido via Gmail alguma vez teve o seu anexo processado.
      // Processar aqui, no mesmo pedido que já tem os anexos em mãos,
      // elimina essa dependência por completo.
      // Antes, marcava-se sempre o email como lido a seguir a isto,
      // mesmo quando processInboundEmail rebentava com uma exceção não
      // apanhada internamente (ex: timeout/erro na chamada à IA que nem
      // chega ao mecanismo interno de "FALHA NA LEITURA AUTOMÁTICA") —
      // o email desaparecia da lista de não lidos sem deixar nenhum
      // rasto, como se nunca tivesse chegado. Agora só se marca como
      // lido se o processamento não rebentar; se rebentar, fica por ler
      // (é retomado automaticamente no próximo ciclo, já protegido pela
      // deduplicação de 3 minutos) e fica registado um erro visível.
      let processadoComSucesso = false;
      try {
        await processInboundEmail({ from, subject, body, anexos });
        processadoComSucesso = true;
      } catch (errProc) {
        console.error("[gmail-reader] Erro ao processar email inbound:", errProc);
        try {
          await supabase.from("ai_auditoria").insert({
            origem: "gmail_reader_erro",
            entidade: from,
            referencia: subject,
            raw_json: { erro: String(errProc?.message || errProc), stack: errProc?.stack || null }
          });
        } catch (errLog) {
          console.error("[gmail-reader] Falha também ao registar o erro em ai_auditoria:", errLog);
        }
      }

      if (processadoComSucesso) {
        await gmail.users.messages.modify({
          userId: "me",
          id: msg.id,
          requestBody: {
            removeLabelIds: ["UNREAD"]
          }
        });
      }
    }

    return res.status(200).json({
      ok: true,
      emails
    });

  } catch (err) {
    console.error("Erro no gmail-reader:", err);
    return res.status(500).json({ error: "Erro no gmail-reader" });
  }
}
