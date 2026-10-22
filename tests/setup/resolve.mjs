import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const projectRoot = new URL('../../', import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  let target = specifier

  if (specifier.startsWith('@/')) {
    target = new URL(specifier.slice(2), projectRoot).href
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    target = new URL(specifier, context.parentURL).href
  }

  if (target.startsWith('file:') && !/\.[cm]?[jt]sx?$/.test(target)) {
    for (const extension of ['.ts', '/index.ts']) {
      if (existsSync(fileURLToPath(target + extension))) {
        return nextResolve(target + extension, context)
      }
    }
  }

  return nextResolve(target, context)
}
