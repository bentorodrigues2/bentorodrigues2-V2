import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

export default async function handler(req, res) {
  try {
    const { id_pagamento } = req.body;

    // 1) Confirmar pagamento
    const { data: pagamento } = await supabase
      .from('pagamentos')
      .update({
        estado: 'confirmado',
        confirmado_em: new Date().toISOString()
      })
      .eq('id', id_pagamento)
      .select()
      .single();

    // 2) Buscar dados completos
    const { data: dados } = await supabase
      .from('pagamentos')
      .select(`
        id,
        valor,
        id_fracao,
        id_proprietario,
        comprovativo_url,
        proprietarios (nome, email, iban, titular_conta, entidade_bancaria),
        fracoes (fracao_nome)
      `)
      .eq('id', id_pagamento)
      .single();

    // 3) Gerar recibo via AI Studio
    const aiResponse = await fetch(process.env.AI_ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'gerar_recibo_pdf',
        dados: {
          pagamento_id: dados.id,
          valor: dados.valor,
          fracao: dados.fracoes.fracao_nome,
          nome: dados.proprietarios.nome,
          email: dados.proprietarios.email,
          iban: dados.proprietarios.iban,
          titular_conta: dados.proprietarios.titular_conta,
          entidade_bancaria: dados.proprietarios.entidade_bancaria,
          comprovativo_url: dados.comprovativo_url
        }
      })
    });

    const recibo = await aiResponse.json();

    // 4) Guardar recibo
    const { data: rec } = await supabase
      .from('recibos')
      .insert({
        id_pagamento: dados.id,
        id_proprietario: dados.id_proprietario,
        id_fracao: dados.id_fracao,
        valor: dados.valor,
        documento_url: recibo.ficheiro.url
      })
      .select()
      .single();

    // 5) Enviar email ao condómino
    await resend.emails.send({
      from: 'Condomínio <no-reply@condominio.pt>',
      to: dados.proprietarios.email,
      subject: recibo.subject,
      html: recibo.message,
      attachments: [
        {
          filename: recibo.ficheiro.filename,
          path: recibo.ficheiro.url
        }
      ]
    });

    res.status(200).json({
      status: 'ok',
      pagamento_confirmado: dados.id,
      recibo_id: rec.id,
      recibo_url: recibo.ficheiro.url
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
