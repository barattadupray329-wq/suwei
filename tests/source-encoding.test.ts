import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoots = ['app', 'components', 'lib']
const sourceExtensions = new Set(['.ts', '.tsx'])
const suspiciousText = [/�/, /銆|鈥|鈴|闂|鏃|鍔|绠|鍚|姝|浜|杩|鏈|鐨|褰|鎴|璇|鍏|鍒/]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return sourceExtensions.has(extname(entry.name)) ? [path] : []
  })
}

describe('源码文本编码', () => {
  it('用户可见源码中不包含替代字符或典型乱码', () => {
    const affected = sourceRoots
      .flatMap(sourceFiles)
      .filter((path) => suspiciousText.some((pattern) => pattern.test(readFileSync(path, 'utf8'))))

    expect(affected).toEqual([])
  })
})
