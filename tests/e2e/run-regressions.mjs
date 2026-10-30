import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const tests = [
  'inline-quote-health.mjs',
  'inline-quote-selection-test.mjs',
  'inline-quote-code-test.mjs',
  'inline-quote-inserted-space-test.mjs',
  'inline-quote-existing-space-test.mjs',
  'inline-quote-delete-clean.mjs',
  'inline-quote-send-test.mjs',
  'inline-quote-parser-test.mjs',
  'inline-quote-sent-render-test.mjs',
  'inline-quote-failure-test.mjs',
  'inline-quote-unload-recovery-test.mjs',
  'inline-quote-reload-delete-test.mjs',
  'inline-quote-capacity-guard-test.mjs',
  'inline-quote-routing-test.mjs',
  'inline-quote-cross-test.mjs',
  'inline-quote-fidelity-test.mjs',
  'inline-quote-separator-edit-test.mjs',
  'inline-quote-capacity-cumulative-test.mjs',
  'inline-quote-rollback-race-test.mjs',
  'inline-quote-host-message-test.mjs',
  'inline-quote-visual-theme-test.mjs',
]
const failures = []
let unverified = 0
for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(here, test)], {
    cwd: here,
    encoding: 'utf8',
    timeout: 180000,
  })
  if (result.status === 2) {
    unverified += 1
    console.log('UNVERIFIED ' + test)
    console.log((result.stdout || '').trim().split('\n').at(-1) || '')
    continue
  }
  const ok = result.status === 0
  console.log((ok ? 'PASS ' : 'FAIL ') + test)
  if (!ok) {
    failures.push(test)
    console.error((result.stdout || '').slice(-3000))
    console.error((result.stderr || '').slice(-3000))
  }
}
if (failures.length > 0) {
  console.error('REGRESSION FAIL: ' + failures.join(', '))
  process.exit(1)
}
console.log('REGRESSION PASS (' + tests.length + ' tests: ' + (tests.length - unverified) + ' passed, ' + unverified + ' unverified)')
process.exit(0)
