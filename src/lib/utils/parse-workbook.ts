import * as XLSX from 'xlsx'

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value).trim()
}

export function parseWorkbookBuffer(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sections: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    sections.push(`Sheet: ${sheetName}`)

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
    })

    for (const row of rows) {
      const text = row
        .map(normalizeCellValue)
        .filter(Boolean)
        .join(' | ')

      if (text) {
        sections.push(text)
      }
    }
  }

  return sections.join('\n').trim()
}
