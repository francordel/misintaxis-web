export const prerender = false;

import type { APIRoute } from 'astro';
import OpenAI from 'openai';

export const post: APIRoute = async ({ request }) => {
  try {
    console.log('[DEBUG /api/analyze] - POST /api/analyze iniciado');

    const { text } = await request.json();
    console.log('[DEBUG /api/analyze] - Texto recibido:', text);

    const api = new OpenAI({
      apiKey: import.meta.env.OPENAI_API_KEY,
    });

    console.log('[DEBUG /api/analyze] - Llamando a OpenAI...');

    const response = await api.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
          Eres un experto analista sintáctico en español que va a analizar las siguientes frases con este formato:
           <s>La final de copa entre Inglaterra y
            Alemania ha tenido un efecto positivo,
            aunque haya pasado casi inadvertido.
           </s>
            <s>[O.Compuesta [GN/S [Det La] [N final]
            [GPrep/CN [E de] [GN/T [N copa]]]
            [GPrep/CN [E entre] [GN/T [N Inglaterra
            y Alemania]]]] [GV/PV [NP ha tenido]
            [GN/CD [Det un] [N efecto] [GAdj/CN
            [Adj positivo]]] [OS.Adverbial/AP [Punt
            ,] [nx aunque] [SO el] [GV/PV [NP haya pasado] [GAdj/PVO [GAdv [Adv casi]]
            [Adj inadvertido]]]]] [Punt .]]</s>...
    `,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const analysis = response.choices[0].message.content?.trim() || '';
    console.log('[DEBUG /api/analyze] - Respuesta de OpenAI:', analysis);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    console.error('[ERROR /api/analyze]', error?.message || error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Error desconocido' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
