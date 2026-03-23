import { promises as fs } from 'node:fs'
import path from 'node:path'

interface StoredUploadFile {
  originalName: string
  storedName: string
}

interface StoredConversationAuditUploads {
  historyFile: StoredUploadFile
  knowledgeFiles: StoredUploadFile[]
}

function getJobUploadDir(jobId: string): string {
  return path.join(process.cwd(), 'data', 'conversation-audit-jobs', jobId, 'uploads')
}

function getManifestPath(jobId: string): string {
  return path.join(getJobUploadDir(jobId), 'manifest.json')
}

async function writeStoredFile(directory: string, storedName: string, file: File): Promise<StoredUploadFile> {
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(path.join(directory, storedName), buffer)

  console.log('[ConversationAudit] Stored upload file', {
    originalName: file.name,
    storedName,
    size: buffer.length,
  })

  return {
    originalName: file.name,
    storedName,
  }
}

export async function persistConversationAuditUploads(
  jobId: string,
  uploads: {
    historyFile: File
    knowledgeFiles: File[]
  }
): Promise<void> {
  const uploadDir = getJobUploadDir(jobId)
  await fs.mkdir(uploadDir, { recursive: true })

  console.log('[ConversationAudit] Persisting uploads', {
    jobId,
    uploadDir,
    historyFileName: uploads.historyFile.name,
    knowledgeFileCount: uploads.knowledgeFiles.length,
  })

  const historyExt = path.extname(uploads.historyFile.name)
  const historyFile = await writeStoredFile(uploadDir, `history${historyExt}`, uploads.historyFile)

  const knowledgeFiles: StoredUploadFile[] = []
  for (const [index, file] of uploads.knowledgeFiles.entries()) {
    const ext = path.extname(file.name)
    knowledgeFiles.push(await writeStoredFile(uploadDir, `knowledge-${index}${ext}`, file))
  }

  const manifest: StoredConversationAuditUploads = {
    historyFile,
    knowledgeFiles,
  }

  await fs.writeFile(getManifestPath(jobId), JSON.stringify(manifest), 'utf-8')
  console.log('[ConversationAudit] Upload manifest written', {
    jobId,
    manifestPath: getManifestPath(jobId),
    knowledgeFileCount: knowledgeFiles.length,
  })
}

export async function readConversationAuditUploads(jobId: string): Promise<{
  historyFile: { name: string; buffer: Buffer }
  knowledgeFiles: Array<{ name: string; buffer: Buffer }>
}> {
  const uploadDir = getJobUploadDir(jobId)
  const manifest = JSON.parse(await fs.readFile(getManifestPath(jobId), 'utf-8')) as StoredConversationAuditUploads

  const historyBuffer = await fs.readFile(path.join(uploadDir, manifest.historyFile.storedName))
  const knowledgeFiles = await Promise.all(
    manifest.knowledgeFiles.map(async (file) => ({
      name: file.originalName,
      buffer: await fs.readFile(path.join(uploadDir, file.storedName)),
    }))
  )

  console.log('[ConversationAudit] Loaded persisted uploads', {
    jobId,
    uploadDir,
    historyFileName: manifest.historyFile.originalName,
    historyFileSize: historyBuffer.length,
    knowledgeFileCount: knowledgeFiles.length,
    knowledgeFiles: knowledgeFiles.map((file) => ({
      name: file.name,
      size: file.buffer.length,
    })),
  })

  return {
    historyFile: {
      name: manifest.historyFile.originalName,
      buffer: historyBuffer,
    },
    knowledgeFiles,
  }
}

export async function clearConversationAuditUploads(jobId: string): Promise<void> {
  console.log('[ConversationAudit] Clearing persisted uploads', {
    jobId,
    uploadRoot: path.join(process.cwd(), 'data', 'conversation-audit-jobs', jobId),
  })
  await fs.rm(path.join(process.cwd(), 'data', 'conversation-audit-jobs', jobId), {
    recursive: true,
    force: true,
  })
}
