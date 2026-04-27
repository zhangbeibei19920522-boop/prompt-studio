import fs from 'node:fs'

import { NextResponse } from 'next/server'

import { findKnowledgeVersionById } from '@/lib/db/repositories/knowledge-versions'
import type { KnowledgeArtifactManifest } from '@/types/database'

const EMPTY_STAGE_ARTIFACTS: KnowledgeArtifactManifest['stageArtifacts'] = {
  sourceManifest: [],
  rawRecords: [],
  cleanedRecords: [],
  routedRecords: [],
  structuredRecords: [],
  promotedRecords: [],
  mergedRecords: [],
  conflictRecords: [],
  gatedRecords: [],
  parents: [],
  chunks: [],
}

function normalizeKnowledgeArtifactManifest(
  manifest: KnowledgeArtifactManifest | Record<string, unknown> | null,
): KnowledgeArtifactManifest | null {
  if (!manifest || typeof manifest !== 'object') {
    return null
  }

  const stageArtifacts =
    manifest.stageArtifacts && typeof manifest.stageArtifacts === 'object'
      ? { ...EMPTY_STAGE_ARTIFACTS, ...(manifest.stageArtifacts as Record<string, Array<Record<string, unknown>>>) }
      : EMPTY_STAGE_ARTIFACTS

  return {
    ...(manifest as KnowledgeArtifactManifest),
    pendingRecords: Array.isArray(manifest.pendingRecords) ? manifest.pendingRecords : [],
    blockedRecords: Array.isArray(manifest.blockedRecords) ? manifest.blockedRecords : [],
    highRiskRecords: Array.isArray(manifest.highRiskRecords) ? manifest.highRiskRecords : [],
    stageArtifacts,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findKnowledgeVersionById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Knowledge version not found' },
        { status: 404 }
      )
    }

    let manifest: KnowledgeArtifactManifest | null = null
    if (data.manifestFilePath && fs.existsSync(data.manifestFilePath)) {
      const rawManifest = JSON.parse(fs.readFileSync(data.manifestFilePath, 'utf-8')) as
        | KnowledgeArtifactManifest
        | Record<string, unknown>
      manifest = normalizeKnowledgeArtifactManifest(rawManifest)
    }

    return NextResponse.json({ success: true, data: { ...data, manifest }, error: null })
  } catch (error) {
    console.error('[GET /api/knowledge-versions/[id]]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge version' },
      { status: 500 }
    )
  }
}
