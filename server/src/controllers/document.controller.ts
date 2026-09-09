import { Prisma, UsageKind, type Document } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams, validatedQuery } from '../middlewares/validate';
import { assertWithinLimit, record } from '../billing/usage.service';
import { badRequest, notFound } from '../utils/httpError';
import type { CreateDocumentInput, DocumentListQuery, IdParam } from '../schemas';

/**
 * Document storage.
 *
 * The upload modal previously took a file, threw it away, and reported
 * "Document uploaded and indexed successfully." Files are now actually stored
 * and counted against the plan.
 *
 * Bytes live in a column for now (`inlineData`), which is honest about its
 * ceiling: the zod schema caps a payload at roughly 8 MB and this refuses
 * anything larger with an explanation rather than truncating. Moving to object
 * storage is a `storageKey` swap on the same model — that column already
 * exists so the migration will not need a schema change.
 */

/** Never return the payload in a list; it would be megabytes per row. */
function serialize(doc: Omit<Document, 'inlineData'> & { inlineData?: string | null }) {
  return {
    id: doc.id,
    name: doc.name,
    category: doc.category,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    sizeLabel: humanSize(doc.sizeBytes),
    leadId: doc.leadId ?? null,
    hasExtractedText: Boolean(doc.extractedText),
    uploadedById: doc.uploadedById ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Decodes a base64 data URL into its parts.
 *
 * The byte length is measured from the decoded buffer rather than the string,
 * so the stored size is the real file size and not the ~33% larger encoding.
 */
export function decodeDataUrl(dataUrl: string): { mimeType: string; base64: string; bytes: number } {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw badRequest('Malformed file payload.');

  const base64 = match[2];
  const bytes = Buffer.from(base64, 'base64').byteLength;

  return { mimeType: match[1], base64, bytes };
}

/** GET /api/documents */
export async function listDocuments(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { limit, cursor, category, leadId, search } = validatedQuery<DocumentListQuery>(req);

  const where: Prisma.DocumentWhereInput = {
    orgId,
    ...(category && category !== 'All Documents' ? { category } : {}),
    ...(leadId ? { leadId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { extractedText: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const rows = await prisma.document.findMany({
    where,
    // Explicit select so the payload column never enters a list response.
    select: {
      id: true,
      orgId: true,
      name: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      storageKey: true,
      extractedText: true,
      leadId: true,
      uploadedById: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const byCategory = await prisma.document.groupBy({
    by: ['category'],
    where: { orgId },
    _count: { _all: true },
    _sum: { sizeBytes: true },
  });

  res.json({
    data: page.map(serialize),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
    categories: byCategory.map((c) => ({
      category: c.category,
      count: c._count._all,
      bytes: c._sum.sizeBytes ?? 0,
    })),
    totalBytes: byCategory.reduce((sum, c) => sum + (c._sum.sizeBytes ?? 0), 0),
  });
}

/** POST /api/documents */
export async function createDocument(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as CreateDocumentInput;

  // Refuse before storing, so a tenant over its allowance does not end up with
  // a file it was not entitled to keep.
  await assertWithinLimit(orgId, UsageKind.document_stored);

  const decoded = decodeDataUrl(input.data);

  if (input.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, orgId },
      select: { id: true },
    });
    if (!lead) throw badRequest('leadId does not reference a lead in your organisation.');
  }

  const doc = await prisma.document.create({
    data: {
      orgId,
      name: input.name,
      category: input.category,
      mimeType: decoded.mimeType,
      sizeBytes: decoded.bytes,
      inlineData: decoded.base64,
      leadId: input.leadId ?? null,
      uploadedById: userId,
      // Plain-text uploads are searchable immediately; extracting from PDFs
      // and images needs a parser that is not wired up, so the field stays
      // null rather than claiming the file was indexed.
      extractedText: decoded.mimeType.startsWith('text/')
        ? Buffer.from(decoded.base64, 'base64').toString('utf8').slice(0, 100_000)
        : null,
    },
  });

  await record({ orgId, userId }, UsageKind.document_stored, {
    metadata: { category: doc.category, bytes: doc.sizeBytes, mimeType: doc.mimeType },
  });

  res.status(201).json(serialize(doc));
}

/**
 * GET /api/documents/:id/content
 *
 * Streams the stored bytes back with the right content type, so the client can
 * download or preview a file it actually uploaded.
 */
export async function getDocumentContent(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const doc = await prisma.document.findFirst({
    where: { id, orgId },
    select: { name: true, mimeType: true, inlineData: true, storageKey: true },
  });

  if (!doc) throw notFound('Document not found');
  if (!doc.inlineData) {
    throw notFound('This document has no stored content on this server.');
  }

  const buffer = Buffer.from(doc.inlineData, 'base64');

  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Length', String(buffer.byteLength));
  // `attachment` so a stored HTML or SVG file cannot execute in the tenant's
  // origin when opened.
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${doc.name.replace(/["\\]/g, '')}"`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}

/** PUT /api/documents/:id — rename, recategorise or relink. */
export async function updateDocument(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const body = req.body as { name?: string; category?: string; leadId?: string | null };

  const existing = await prisma.document.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw notFound('Document not found');

  if (body.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, orgId },
      select: { id: true },
    });
    if (!lead) throw badRequest('leadId does not reference a lead in your organisation.');
  }

  const doc = await prisma.document.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.leadId !== undefined ? { leadId: body.leadId } : {}),
    },
  });

  res.json(serialize(doc));
}

/** DELETE /api/documents/:id */
export async function deleteDocument(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const { count } = await prisma.document.deleteMany({ where: { id, orgId } });
  if (count === 0) throw notFound('Document not found');

  res.status(204).end();
}
