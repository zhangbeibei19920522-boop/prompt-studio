import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'

describe('globals.css imports', () => {
  test('uses package imports instead of relative node_modules paths', () => {
    const globalsPath = path.join(process.cwd(), 'src', 'app', 'globals.css')
    const css = fs.readFileSync(globalsPath, 'utf-8')

    expect(css).toContain('@import "tw-animate-css";')
    expect(css).not.toContain('../../node_modules/')
  })
})
