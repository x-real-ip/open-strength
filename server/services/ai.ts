// Thin provider abstraction. Supports the Anthropic Messages API and any
// OpenAI-compatible chat completions endpoint (OpenAI, Ollama, LM Studio, LiteLLM, ...).
// API keys never leave the server.
import { aiConfigured, config } from '../config.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** Ask the model for a single JSON object. */
  json?: boolean;
}

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new AiError(`AI provider returned ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as Error).name === 'AbortError') throw new AiError('AI request timed out', 504);
    throw new AiError(`AI request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function complete(req: CompletionRequest): Promise<string> {
  if (!aiConfigured()) throw new AiError('AI is not configured. Set AI_API_KEY (and optionally AI_PROVIDER, AI_MODEL).', 503);
  const maxTokens = req.maxTokens ?? 4000;

  if (config.ai.provider === 'anthropic') {
    const data = await post(
      `${config.ai.baseUrl}/v1/messages`,
      { 'x-api-key': config.ai.apiKey, 'anthropic-version': '2023-06-01' },
      { model: config.ai.model, max_tokens: maxTokens, system: req.system, messages: req.messages },
    );
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
    if (!text) throw new AiError('AI returned an empty response');
    return text;
  }

  const headers: Record<string, string> = {};
  if (config.ai.apiKey) headers.authorization = `Bearer ${config.ai.apiKey}`;
  const data = await post(`${config.ai.baseUrl}/chat/completions`, headers, {
    model: config.ai.model,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: req.system }, ...req.messages],
    ...(req.json ? { response_format: { type: 'json_object' } } : {}),
  });
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new AiError('AI returned an empty response');
  return text;
}

/** Extract the first JSON object from a model response (tolerates code fences and prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiError('AI response contained no JSON object');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiError('AI response contained invalid JSON');
  }
}
