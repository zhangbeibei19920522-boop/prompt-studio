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

  test('does not require remote Google Fonts during package builds', () => {
    const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx')
    const globalsPath = path.join(process.cwd(), 'src', 'app', 'globals.css')
    const layout = fs.readFileSync(layoutPath, 'utf-8')
    const css = fs.readFileSync(globalsPath, 'utf-8')

    expect(layout).not.toContain('next/font/google')
    expect(css).toContain('--font-geist-sans:')
    expect(css).toContain('--font-geist-mono:')
  })
})
