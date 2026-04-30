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
      defval: '',
    })

    for (const row of rows) {
      const cells = row.map(normalizeCellValue)
      while (cells.length > 0 && !cells[cells.length - 1]) {
        cells.pop()
      }
      const text = cells.join(' | ')

      if (text) {
        sections.push(text)
      }
    }
  }

  return sections.join('\n').trim()
}
