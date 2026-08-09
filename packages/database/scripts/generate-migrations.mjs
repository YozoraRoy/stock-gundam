import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '..', 'migrations')
const outFile = join(here, '..', 'src', 'generated', 'migrations.ts')

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
const entries = files.map((f) => ({
  name: f,
  sql: readFileSync(join(migrationsDir, f), 'utf-8'),
}))

const header =
  '// GENERATED FILE - do not edit by hand.\n// Regenerate with: npm run db:generate-migrations\n\n'

const body = entries
  .map((e) => `  { name: ${JSON.stringify(e.name)}, sql: ${JSON.stringify(e.sql)} },`)
  .join('\n')

const content =
  `${header}export interface Migration {\n  name: string\n  sql: string\n}\n\n` +
  `export const MIGRATIONS: Migration[] = [\n${body}\n]\n`

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, content, 'utf-8')
console.log(`Generated ${outFile} with ${entries.length} migrations`)
