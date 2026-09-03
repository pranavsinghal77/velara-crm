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

const REQUEST_TIMEOUT_MS = 20_000;

const client = env.aiEnabled ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

export const aiAvailable = () => client !== null;

function assertAvailable(): GoogleGenerativeAI {
  if (!client) {
    throw serviceUnavailable(
      'AI features are not configured on this server. Set GEMINI_API_KEY to enable them.'
    );
  }
  return client;
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

export async function generateText(prompt: string): Promise<string> {
  const model = assertAvailable().getGenerativeModel({ model: env.GEMINI_MODEL });

  try {
    const result = await withTimeout(model.generateContent(prompt), 'AI request');
    const text = result.response.text().trim();
    if (!text) throw new Error('empty completion');
    return text;
  } catch (err) {
    logger.error('AI text generation failed', {
      model: env.GEMINI_MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    throw serviceUnavailable('The AI service is currently unavailable. Please try again.');
  }
}

/**
 * Ask for JSON, then validate it. A response that does not match the schema is
 * an error, not something to silently substitute a plausible default for.
 */
export async function generateJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
  const model = assertAvailable().getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  });

  let raw: string;
  try {
    const result = await withTimeout(model.generateContent(prompt), 'AI request');
    raw = result.response.text().trim();
  } catch (err) {
    logger.error('AI JSON generation failed', {
      model: env.GEMINI_MODEL,
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
  schema: ZodType<T>
): Promise<T> {
  const model = assertAvailable().getGenerativeModel({
    model: env.GEMINI_VISION_MODEL,
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
