// Lets `node --test` load the app's TypeScript modules: Node strips the types,
// this hook resolves the `@/` alias and extensionless imports to `.ts` files.
import { register } from 'node:module'

register('./resolve.mjs', import.meta.url)
