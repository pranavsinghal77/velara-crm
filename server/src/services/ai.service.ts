import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ZodType } from 'zod';
import { env } from '../config/env';
import { serviceUnavailable } from '../utils/httpError';
import { logger } from '../utils/logger';

/**
 * Thin wrapper around Gemini with three rules the previous implementation
 * broke:
 *
 *  1. If AI is not configured or the call fails, we say so. We do not invent
 *     sentiment scores, compliance verdicts or pipeline summaries and return
 *     them as if a model produced them.
 *  2. Model ids come from configuration, not hardcoded strings. The old code
 *     declared an `ACTIVE_MODELS` fallback list, never read it, and hardcoded
 *     a model id in two places.
 *  3. Structured responses are requested as JSON and validated against a
 *     schema before use, instead of regex-stripping markdown fences and
 *     hoping.
 */

const REQUEST_TIMEOUT_MS = env.AI_REQUEST_TIMEOUT_MS;

const platformClient = env.aiEnabled ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

/**
 * Which credential a request runs on.
 *
 * A tenant that supplies its own key pays its own provider bill, so that usage
 * is recorded at zero cost and is not charged against the plan's AI allowance.
 * Requests on the platform key are metered and billed.
 */
export interface AiCredential {
  apiKey?: string;
  model?: string;
  visionModel?: string;
  /** True when running on the tenant's own key. */
  tenantFunded: boolean;
}

/** True when a platform key is configured. Says nothing about whether it works. */
export const aiConfigured = () => platformClient !== null;

/**
 * The last thing the provider actually did.
 *
 * Every call updates this, so reporting availability costs no extra request.
 * A configured key with a retired model id looks identical to a working setup
 * until something calls out — and then this is the difference between the UI
 * saying "AI is unavailable: the model returned 404" and it offering a button
 * that 503s.
 */
interface AiHealth {
  configured: boolean;
  model: string;
  lastSuccessAt: string | null;
  lastError: { message: string; model: string; at: string } | null;
}

const health: { lastSuccessAt: Date | null; lastError: { message: string; model: string; at: Date } | null } = {
  lastSuccessAt: null,
  lastError: null,
};

function recordSuccess() {
  health.lastSuccessAt = new Date();
  health.lastError = null;
}

function recordFailure(model: string, err: unknown) {
  health.lastError = {
    // The provider's own words. A retired model, a revoked key and a quota
    // ceiling all arrive here, and they need different fixes.
    message: err instanceof Error ? err.message : String(err),
    model,
    at: new Date(),
  };
}

export function aiHealth(): AiHealth {
  return {
    configured: aiConfigured(),
    model: env.GEMINI_MODEL,
    lastSuccessAt: health.lastSuccessAt?.toISOString() ?? null,
    lastError: health.lastError
      ? {
          message: health.lastError.message,
          model: health.lastError.model,
          at: health.lastError.at.toISOString(),
        }
      : null,
  };
}

/** Per-tenant clients are cached so a hot tenant is not re-instantiating one. */
const tenantClients = new Map<string, GoogleGenerativeAI>();

function clientFor(credential?: AiCredential): GoogleGenerativeAI {
  if (credential?.apiKey) {
    let cached = tenantClients.get(credential.apiKey);
    if (!cached) {
      cached = new GoogleGenerativeAI(credential.apiKey);
      // Bounded so a long-lived process cannot accumulate clients forever.
      if (tenantClients.size > 200) tenantClients.clear();
      tenantClients.set(credential.apiKey, cached);
    }
    return cached;
  }

  if (!platformClient) {
    throw serviceUnavailable(
      'AI features are not configured. Add your own provider key in Settings, or ask your administrator to configure one.'
    );
  }
  return platformClient;
}

function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(serviceUnavailable(`${label} timed out`)),
      REQUEST_TIMEOUT_MS
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * User-supplied text is fenced inside a clearly delimited block and the model
 * is told to treat it as data. This does not make prompt injection impossible,
 * but it removes the trivial case, and no endpoint lets a caller replace the
 * system instructions wholesale any more.
 */
export function asUntrustedInput(label: string, value: string): string {
  const fence = '<<<END_' + label.toUpperCase() + '>>>';
  return [
    `<${label}>`,
    value.replaceAll(fence, ''),
    `</${label}>`,
  ].join('\n');
}

export async function generateText(
  prompt: string,
  credential?: AiCredential
): Promise<string> {
  const model = clientFor(credential).getGenerativeModel({
    model: credential?.model ?? env.GEMINI_MODEL,
  });

  try {
    const result = await withTimeout(model.generateContent(prompt), 'AI request');
    const text = result.response.text().trim();
    if (!text) throw new Error('empty completion');
    recordSuccess();
    return text;
  } catch (err) {
    recordFailure(credential?.model ?? env.GEMINI_MODEL, err);
    logger.error('AI text generation failed', {
      model: credential?.model ?? env.GEMINI_MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    throw serviceUnavailable('The AI service is currently unavailable. Please try again.');
  }
}

/**
 * Ask for JSON, then validate it. A response that does not match the schema is
 * an error, not something to silently substitute a plausible default for.
 */
export async function generateJson<T>(
  prompt: string,
  schema: ZodType<T>,
  credential?: AiCredential
): Promise<T> {
  const model = clientFor(credential).getGenerativeModel({
    model: credential?.model ?? env.GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  });

  let raw: string;
  try {
    const result = await withTimeout(model.generateContent(prompt), 'AI request');
    raw = result.response.text().trim();
    recordSuccess();
  } catch (err) {
    recordFailure(credential?.model ?? env.GEMINI_MODEL, err);
    logger.error('AI JSON generation failed', {
      model: credential?.model ?? env.GEMINI_MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    throw serviceUnavailable('The AI service is currently unavailable. Please try again.');
  }

  return parseJsonOrThrow(raw, schema);
}

/**
 * Vision call. The image is genuinely sent to the model as inline data - the
 * previous `visual-compliance` endpoint read `imageUrl` from the body,
 * validated that it existed, then never referenced it again, so every field
 * photo was "approved" without being looked at.
 */
export async function generateJsonFromImage<T>(
  prompt: string,
  dataUrl: string,
  schema: ZodType<T>,
  credential?: AiCredential
): Promise<T> {
  const model = clientFor(credential).getGenerativeModel({
    model: credential?.visionModel ?? env.GEMINI_VISION_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });

  const parsedImage = parseDataUrl(dataUrl);

  let raw: string;
  try {
    const result = await withTimeout(
      model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: parsedImage.mimeType, data: parsedImage.base64 } },
      ]),
      'AI vision request'
    );
    raw = result.response.text().trim();
  } catch (err) {
    logger.error('AI vision generation failed', {
      model: env.GEMINI_VISION_MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    throw serviceUnavailable(
      'The image analysis service is currently unavailable. The task has been left unverified.'
    );
  }

  return parseJsonOrThrow(raw, schema);
}

function parseJsonOrThrow<T>(raw: string, schema: ZodType<T>): T {
  // Belt and braces: responseMimeType should give us bare JSON, but strip a
  // markdown fence if one appears anyway.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error('AI returned non-JSON output', { sample: cleaned.slice(0, 200) });
    throw serviceUnavailable('The AI service returned an unreadable response.');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    logger.error('AI response failed schema validation', {
      issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    throw serviceUnavailable('The AI service returned an unexpected response shape.');
  }

  return result.data;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) {
    throw serviceUnavailable('Unsupported image payload');
  }
  return { mimeType: match[1], base64: match[2] };
}
