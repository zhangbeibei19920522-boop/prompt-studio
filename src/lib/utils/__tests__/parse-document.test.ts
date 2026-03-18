import * as XLSX from 'xlsx'

import { parseDocumentBuffer } from '@/lib/utils/parse-document'

describe('parseDocumentBuffer', () => {
  it('extracts visible text from html documents', async () => {
    const html = `
      <html>
        <head>
          <style>.hidden { display: none; }</style>
          <script>console.log('ignored')</script>
        </head>
        <body>
          <h1>Help Center</h1>
          <p>Password reset &amp; account recovery</p>
        </body>
      </html>
    `

    const result = await parseDocumentBuffer(Buffer.from(html), 'html')

    expect(result).toContain('Help Center')
    expect(result).toContain('Password reset & account recovery')
    expect(result).not.toContain('console.log')
    expect(result).not.toContain('<h1>')
  })

  it('renders workbook sheets and rows into readable text', async () => {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Question', 'Answer'],
      ['Reset password', 'Use the password reset link'],
    ])
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FAQ')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const result = await parseDocumentBuffer(buffer, 'xlsx')

    expect(result).toContain('Sheet: FAQ')
    expect(result).toContain('Question')
    expect(result).toContain('Reset password')
    expect(result).toContain('Use the password reset link')
  })

  it('keeps plain text documents unchanged', async () => {
    const result = await parseDocumentBuffer(Buffer.from('plain text body'), 'txt')

    expect(result).toBe('plain text body')
  })

  it('keeps doc html fallback behavior intact', async () => {
    const result = await parseDocumentBuffer(Buffer.from('<p>Legacy doc body</p>'), 'doc')

    expect(result).toContain('Legacy doc body')
    expect(result).not.toContain('<p>')
  })
})
