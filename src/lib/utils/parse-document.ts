/**
 * Server-side document parser.
 * Extracts plain text from PDF, DOCX, and text-based files.
 */

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
    case 'docx':
    case 'doc': {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    }
    case 'md':
    case 'txt':
    case 'markdown':
    default:
      return buffer.toString('utf-8')
  }
}
