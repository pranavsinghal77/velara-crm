import { UsageKind } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { encrypt, encryptionAvailable, hint } from '../utils/encryption';
import { badRequest, serviceUnavailable } from '../utils/httpError';
import { logger } from '../utils/logger';
import { createLeadViaTool } from '../services/leadWrite.service';
import { assertWithinLimit } from '../billing/usage.service';
import {
  candidateToLead,
  mapPerson,
  resolveApolloKey,
  searchPeople,
  type ApolloError,
  type ApolloSearchFilters,
  type LeadCandidate,
} from '../services/apollo.service';
import type { ApolloImportInput, ApolloSearchInput } from '../schemas';

/**
 * Apollo.io integration: source prospects from Apollo's contact database and
 * import the chosen ones as leads.
 *
 * Search and import are two steps on purpose. Search previews candidates and
 * flags which ones the workspace already has and which have a locked email;
 * import then creates only what the caller picked, through the one lead-write
 * service so plan limits, metering and workflow triggers all apply exactly as
 * they do for a hand-typed lead. A bulk import is not a way to bypass the plan.
 */

function requireEncryption() {
  if (!encryptionAvailable()) {
    throw serviceUnavailable(
      'This server has no ENCRYPTION_KEY configured, so the Apollo key cannot be stored securely. Ask your administrator to set one.'
    );
  }
}

/** GET /api/apollo/config */
export async function getApolloConfig(req: Request, res: Response) {
  const { orgId } = auth(req);
  const config = await prisma.apolloConfig.findUnique({ where: { orgId } });

  res.json({
    configured: Boolean(config?.apiKeyEnc),
    enabled: config?.enabled ?? false,
    lastImportAt: config?.lastImportAt?.toISOString() ?? null,
    importedTotal: config?.importedTotal ?? 0,
    // So the settings screen can explain the ceiling before an import, not after.
    encryptionAvailable: encryptionAvailable(),
  });
}

/** PUT /api/apollo/config — store or clear the key, toggle sourcing. */
export async function updateApolloConfig(req: Request, res: Response) {
  const { orgId } = auth(req);
  const body = req.body as { apiKey?: string | null; enabled?: boolean };

  if (body.apiKey) requireEncryption();

  // Clearing the key removes the row entirely, so `configured` and `enabled`
  // cannot drift apart into a state where sourcing is "on" with no key.
  if (body.apiKey === null) {
    await prisma.apolloConfig.deleteMany({ where: { orgId } });
    return res.json({ configured: false, enabled: false });
  }

  if (!body.apiKey && (await prisma.apolloConfig.findUnique({ where: { orgId } })) === null) {
    throw badRequest('Provide an Apollo API key to enable sourcing.');
  }

  const data = {
    ...(body.apiKey ? { apiKeyEnc: encrypt(body.apiKey) } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
  };

  const config = await prisma.apolloConfig.upsert({
    where: { orgId },
    // upsert-create needs the key; the schema requires it, and the guard above
    // ensures we only reach here on create when a key was supplied.
    create: { orgId, apiKeyEnc: data.apiKeyEnc!, enabled: body.enabled ?? true },
    update: data,
  });

  res.json({
    configured: true,
    enabled: config.enabled,
    keyHint: body.apiKey ? hint(body.apiKey) : undefined,
  });
}

/**
 * POST /api/apollo/test — prove the stored key works.
 *
 * Runs the smallest possible real search (one result) so the answer reflects
 * what an actual import would hit, and reports Apollo's own message on failure.
 */
export async function testApollo(req: Request, res: Response) {
  const { orgId } = auth(req);
  const resolved = await resolveApolloKey(orgId);
  if (resolved.key === null) throw badRequest(resolved.reason);

  try {
    const result = await searchPeople(resolved.key, { perPage: 1, page: 1 });
    res.json({
      ok: true,
      reachable: true,
      // Total tells the tenant their key can actually see records, not just
      // authenticate.
      sampleTotal: result.total,
    });
  } catch (err) {
    const e = err as ApolloError;
    res.status(e.status && e.status < 500 ? 400 : 502).json({
      ok: false,
      reachable: (e.status ?? 500) < 500,
      error: e.message,
    });
  }
}

function toFilters(input: ApolloSearchInput): ApolloSearchFilters {
  return {
    titles: input.titles,
    locations: input.locations,
    organizationDomains: input.organizationDomains,
    employeeRanges: input.employeeRanges,
    keywords: input.keywords,
    page: input.page,
    perPage: input.perPage,
  };
}

/**
 * POST /api/apollo/search — preview candidates without importing.
 *
 * Marks each candidate that the workspace already holds (matched on the Apollo
 * person id recorded at import), so the UI can grey out duplicates rather than
 * letting the tenant spend a plan slot re-importing someone.
 */
export async function searchApollo(req: Request, res: Response) {
  const { orgId } = auth(req);
  const input = req.body as ApolloSearchInput;

  const resolved = await resolveApolloKey(orgId);
  if (resolved.key === null) throw badRequest(resolved.reason);

  let result;
  try {
    result = await searchPeople(resolved.key, toFilters(input));
  } catch (err) {
    const e = err as ApolloError;
    throw e.status && e.status < 500
      ? badRequest(e.message)
      : serviceUnavailable(e.message);
  }

  const candidates = result.people
    .map(mapPerson)
    .filter((c): c is LeadCandidate => c !== null);

  // One query to find which of these we already have, rather than one per row.
  const refs = candidates.map((c) => c.sourceRef);
  const existing = refs.length
    ? await prisma.lead.findMany({
        where: { orgId, source: 'Apollo', sourceRef: { in: refs } },
        select: { sourceRef: true },
      })
    : [];
  const already = new Set(existing.map((l) => l.sourceRef));

  res.json({
    data: candidates.map((c) => ({ ...c, alreadyImported: already.has(c.sourceRef) })),
    pagination: { page: result.page, totalPages: result.totalPages, totalEntries: result.total },
    summary: {
      returned: candidates.length,
      newToWorkspace: candidates.filter((c) => !already.has(c.sourceRef)).length,
      emailLocked: candidates.filter((c) => c.emailLocked).length,
    },
  });
}

/**
 * POST /api/apollo/import — create leads from a fresh search.
 *
 * Re-runs the search server-side rather than trusting candidate rows posted
 * back by the client: a client could otherwise submit arbitrary "leads" under
 * the guise of an Apollo import, and the whole point of sourcing is that the
 * data came from Apollo. The client sends the same filters plus the person ids
 * it chose.
 */
export async function importApollo(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as ApolloImportInput;

  const resolved = await resolveApolloKey(orgId);
  if (resolved.key === null) throw badRequest(resolved.reason);

  const chosen = new Set(input.personIds);

  let result;
  try {
    result = await searchPeople(resolved.key, toFilters(input));
  } catch (err) {
    const e = err as ApolloError;
    throw e.status && e.status < 500 ? badRequest(e.message) : serviceUnavailable(e.message);
  }

  const candidates = result.people
    .map(mapPerson)
    .filter((c): c is LeadCandidate => c !== null && chosen.has(c.sourceRef));

  // Skip anyone already imported, so a repeated import is idempotent.
  const refs = candidates.map((c) => c.sourceRef);
  const existing = refs.length
    ? await prisma.lead.findMany({
        where: { orgId, source: 'Apollo', sourceRef: { in: refs } },
        select: { sourceRef: true },
      })
    : [];
  const already = new Set(existing.map((l) => l.sourceRef));

  const imported: { id: string; name: string; sourceRef: string }[] = [];
  let skippedDuplicate = 0;
  let limitReached = false;
  const failures: { name: string; reason: string }[] = [];

  for (const candidate of candidates) {
    if (already.has(candidate.sourceRef)) {
      skippedDuplicate += 1;
      continue;
    }

    // Check the allowance before each create so a partial import stops cleanly
    // at the plan ceiling rather than throwing halfway and losing the count.
    try {
      await assertWithinLimit(orgId, UsageKind.lead_created);
    } catch {
      limitReached = true;
      break;
    }

    try {
      const lead = await prisma.$transaction(async () => {
        const created = await createLeadViaTool({
          orgId,
          actorId: userId,
          ownerId: undefined,
          input: candidateToLead(candidate),
        });
        // The write service does not know about Apollo; stamp the provenance
        // so a future import recognises this person.
        await prisma.lead.update({
          where: { id: created.id },
          data: { sourceRef: candidate.sourceRef },
        });
        return created;
      });
      imported.push({ id: lead.id, name: lead.name, sourceRef: candidate.sourceRef });
    } catch (err) {
      failures.push({
        name: candidate.name,
        reason: err instanceof Error ? err.message : 'Import failed',
      });
      logger.warn('Apollo lead import failed', {
        orgId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (imported.length > 0) {
    await prisma.apolloConfig.update({
      where: { orgId },
      data: { lastImportAt: new Date(), importedTotal: { increment: imported.length } },
    });
  }

  res.json({
    imported: imported.length,
    leads: imported,
    skippedDuplicate,
    failed: failures.length,
    failures,
    limitReached,
    message: limitReached
      ? `Imported ${imported.length}. Stopped at your plan's lead limit; upgrade to import the rest.`
      : `Imported ${imported.length} lead(s).`,
  });
}
