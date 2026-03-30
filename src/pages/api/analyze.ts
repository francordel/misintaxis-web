export const prerender = false;

import type { APIRoute } from 'astro';
import OpenAI from 'openai';

import promptYaml from '../../data/prompt.yaml?raw';
import fewshotTxt from '../../data/fewshot_app.txt?raw';

// ── Prompt y few-shot (cargados una vez al arrancar) ──────────────────────────
function parseSystemPrompt(yaml: string): string {
  const match = yaml.match(/^system_prompt: \|\n([\s\S]+)$/m);
  if (!match) throw new Error('No se encontró system_prompt en prompt.yaml');
  return match[1].replace(/^  /gm, '').trimEnd();
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function parseFewShot(txt: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const line of txt.trim().split('\n')) {
    const match = line.match(/<s>(.*?)<\/s><s>(.*?)<\/s>/);
    if (match) {
      messages.push({ role: 'user',      content: match[1] });
      messages.push({ role: 'assistant', content: match[2] });
    }
  }
  return messages;
}

const SYSTEM_PROMPT    = parseSystemPrompt(promptYaml);
const FEW_SHOT_MESSAGES = parseFewShot(fewshotTxt);

// ── Protección: rate limit por IP + límite de concurrencia ───────────────────
//
//  NOTA: estas estructuras viven en memoria del proceso.
//  - En local/Node.js persisten mientras el servidor esté arriba.
//  - En Cloudflare Workers NO persisten (cada Worker es stateless).
//    Para CF habría que usar Workers KV o Cloudflare WAF Rate Limiting.

const RATE_LIMIT    = 15;        // máximo de requests por IP por ventana
const WINDOW_MS     = 60_000;    // ventana de 1 minuto
const MAX_CONCURRENT = 10;       // máximo de llamadas simultáneas a OpenAI

// Ventana deslizante: IP → array de timestamps de requests
const ipWindows = new Map<string, number[]>();

// Nota: en Cloudflare Workers la memoria es por isolate (stateless entre requests).
// El rate limiting en memoria es best-effort; Cloudflare WAF cubre el resto.

// Devuelve true si la IP está dentro del límite, false si está bloqueada
function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  const times = (ipWindows.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  if (times.length >= RATE_LIMIT) return false;
  times.push(now);
  ipWindows.set(ip, times);
  return true;
}

// Contador de llamadas activas a OpenAI
let activeCalls = 0;

// ── Endpoint ──────────────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 1. Identificar IP (clientAddress en Astro SSR; x-forwarded-for como fallback)
  const ip = clientAddress ?? request.headers.get('x-forwarded-for') ?? 'unknown';

  // 2. Rate limit por IP
  if (!checkRateLimit(ip)) {
    console.warn(`[analyze] Rate limit superado: ${ip}`);
    return new Response(
      JSON.stringify({ success: false, error: 'Demasiadas peticiones. Espera un minuto.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    );
  }

  // 3. Límite de concurrencia global (protección de coste)
  if (activeCalls >= MAX_CONCURRENT) {
    console.warn(`[analyze] Servidor saturado (${activeCalls} llamadas activas)`);
    return new Response(
      JSON.stringify({ success: false, error: 'El servidor está ocupado. Intenta en unos segundos.' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '5' } },
    );
  }

  // 4. Validar entrada mínimamente
  let text: string;
  try {
    ({ text } = await request.json());
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Cuerpo de la petición inválido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'La frase no puede estar vacía.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Limitar longitud de entrada (evitar prompts gigantes)
  if (text.length > 500) {
    return new Response(
      JSON.stringify({ success: false, error: 'La frase es demasiado larga (máx. 500 caracteres).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 5. Llamada a OpenAI con guard de concurrencia
  activeCalls++;
  try {
    const api = new OpenAI({ apiKey: import.meta.env.OPENAI_API_KEY });

    const response = await api.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...FEW_SHOT_MESSAGES,
        { role: 'user', content: text.trim() },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const analysis = response.choices[0].message.content?.trim() ?? '';
    console.log(`[analyze] OK | IP: ${ip} | activas: ${activeCalls}`);

    return new Response(JSON.stringify({ success: true, analysis }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[analyze] Error | IP: ${ip} |`, error?.message ?? error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al analizar la frase.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    activeCalls--;
  }
};
