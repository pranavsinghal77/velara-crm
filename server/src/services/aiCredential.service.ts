import { prisma } from '../config/db';
import { env } from '../config/env';
import { decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import type { AiCredential } from './ai.service';

/**
 * Decides which credential an AI request runs on.
 *
 * A tenant with its own key pays its own provider bill, so those calls are
 * recorded at zero cost and do not consume the plan's AI allowance. Calls on
 * the platform key are metered and billed. `estimatedCostPaise` is what the
 * platform charges for one request on our key — deliberately a flat figure
 * rather than a guess at token pricing, so an invoice line is explainable.
 */

/** Platform charge per AI request on our key, in paise. */
export const PLATFORM_AI_REQUEST_PAISE = 50;

export interface ResolvedAi {
  credential: AiCredential;
  /** Cost to attribute to this tenant for one request. */
  costPaise: number;
  /** False when the tenant has switched AI off for their workspace. */
  enabled: boolean;
  reason?: string;
}

export async function resolveAiCredential(orgId: string): Promise<ResolvedAi> {
  const config = await prisma.aiProviderConfig.findUnique({ where: { orgId } });

  if (config && !config.enabled) {
    return {
      credential: { tenantFunded: false },
      costPaise: 0,
      enabled: false,
      reason: 'AI is switched off for this workspace in Settings.',
    };
  }

  if (config?.apiKeyEnc) {
    try {
      return {
        credential: {
          apiKey: decrypt(config.apiKeyEnc),
          model: config.model,
          visionModel: config.visionModel,
          tenantFunded: true,
        },
        costPaise: 0,
        enabled: true,
      };
    } catch (err) {
      // A key we cannot decrypt is a configuration fault, not a reason to
      // silently fall back to the platform key and bill the tenant for it.
      logger.error('Tenant AI key could not be decrypted', {
        orgId,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        credential: { tenantFunded: false },
        costPaise: 0,
        enabled: false,
        reason:
          'Your stored AI key could not be read. Re-enter it in Settings to restore AI features.',
      };
    }
  }

  return {
    credential: {
      model: config?.model ?? env.GEMINI_MODEL,
      visionModel: config?.visionModel ?? env.GEMINI_VISION_MODEL,
      tenantFunded: false,
    },
    costPaise: PLATFORM_AI_REQUEST_PAISE,
    enabled: env.aiEnabled,
    reason: env.aiEnabled ? undefined : 'No AI provider key is configured on this server.',
  };
}
