/**
 * Server-side document parser.
 * Extracts plain text from PDF, DOCX, DOC, and text-based files.
 * Uses magic bytes to detect actual file format, not just extension.
 */
import { extractTextFromHtml } from '@/lib/utils/parse-html'
import { parseWorkbookBuffer } from '@/lib/utils/parse-workbook'

// OLE2 Compound Document magic bytes (used by .doc)
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]
// ZIP magic bytes (used by .docx)
const ZIP_MAGIC = [0x50, 0x4b]

function isOle2(buffer: Buffer): boolean {
  return buffer.length >= 4 && OLE2_MAGIC.every((b, i) => buffer[i] === b)
}

function isZip(buffer: Buffer): boolean {
  return buffer.length >= 2 && ZIP_MAGIC.every((b, i) => buffer[i] === b)
}

async function parseWithMammoth(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

async function parseWithWordExtractor(buffer: Buffer): Promise<string> {
  const WordExtractor = (await import('word-extractor')).default
  const extractor = new WordExtractor()
  const doc = await extractor.extract(buffer)
  return doc.getBody()
}

export async function parseDocumentBuffer(
  buffer: Buffer,
  ext: string
): Promise<string> {
  const normalizedExt = ext.toLowerCase().replace(/^\./, '')

  switch (normalizedExt) {
    case 'pdf': {
      const { PDFParse } = await import('pdf-parse')
      const pdf = new PDFParse({ data: new Uint8Array(buffer) })
      const result = await pdf.getText()
      const text = result.text
      await pdf.destroy()
      return text
    }
    case 'doc':
    case 'docx': {
      // Detect actual format by magic bytes, not extension
      if (isOle2(buffer)) {
        return parseWithWordExtractor(buffer)
      }
      if (isZip(buffer)) {
        return parseWithMammoth(buffer)
      }
      // Neither OLE2 nor ZIP — likely HTML/RTF saved as .doc (common)
      return extractTextFromHtml(buffer.toString('utf-8'))
    }
    case 'htm':
    case 'html': {
      return extractTextFromHtml(buffer.toString('utf-8'))
    }
    case 'csv':
    case 'xls':
    case 'xlsx': {
      return parseWorkbookBuffer(buffer)
    }
    case 'md':
    case 'txt':
    case 'markdown':
    default:
      return buffer.toString('utf-8')
  }
}
