import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { connect } from './cdp.mjs'

const LOG_PATH = process.env.INLINE_QUOTE_HOST_LOG
  ?? join(tmpdir(), 'inline-quote-host-requests.jsonl')
const QUOTED = 'Mock Host response for inline-quote acceptance.'

const before = fs.existsSync(LOG_PATH)
  ? fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean).length
  : 0

const { evaluate } = await connect()
const page = await evaluate(`(async () => {
  window.__QUOTE_PROBE_MOCK_SEND__ = false
  const wait = async (fn, timeout = 30000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const value = fn()
      if (value) return value
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('wait timeout')
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const get = () => window.__QUOTE_PROBE_DOCK__
  const assistantRows = () => [...document.querySelectorAll('[data-chat-flow-kind="assistant-step"]')]
    .filter((row) => row.innerText.includes('Mock Host response'))
  get().inputActions.setDraft('')
  await wait(() => get().input.draft === '')
  if (assistantRows().length === 0) {
    get().inputActions.setDraft('Host 创建消息：这是一条由真实 Host 持久化的用户消息。')
    await wait(() => get().input.draft.includes('Host 创建消息'))
    get().inputActions.submit()
    await wait(() => assistantRows().length > 0)
  }
  const row = assistantRows()[assistantRows().length - 1]
  const target = [...row.querySelectorAll('*')].find((el) =>
    el.childNodes.length === 1 && el.firstChild?.nodeType === 3 && el.innerText.includes('Mock Host response')) ?? row
  const range = document.createRange()
  range.selectNodeContents(target)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  await sleep(400)
  const button = [...document.querySelectorAll('button')].find((item) => (item.innerText || '').trim() === '引用')
  if (!button) return { ok: false, error: 'quote button missing' }
  button.click()
  await wait(() => get().input.occurrences.length === 1)
  const payload = window.__QUOTE_PROBE_DECODE_REF__(get().input.occurrences[0].ref)
  const caret = get().inputActions.captureInsertion()
  get().inputActions.insertText(' 请解释这段。', { start: caret.end, end: caret.end, draftRev: caret.draftRev })
  await wait(() => get().input.draft.endsWith('请解释这段。'))
  const draft = get().input.draft
  get().inputActions.submit()
  await sleep(3500)
  window.__QUOTE_PROBE_MOCK_SEND__ = true
  return { ok: true, payloadText: payload.text, draft }
})()`)

const lines = fs.existsSync(LOG_PATH)
  ? fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean).slice(before)
  : []
const requests = lines.map((line) => JSON.parse(line))
const matching = requests.filter((entry) =>
  JSON.stringify(entry.messages ?? []).includes('DSH_QUOTE') &&
  JSON.stringify(entry.messages ?? []).includes(QUOTED))

console.log(JSON.stringify({
  page,
  newRequests: requests.length,
  matchingHostRequests: matching.length,
  sample: matching.at(-1)?.messages
    ?.flatMap((message) => message.content ?? [])
    ?.filter((part) => part.type === 'text')
    ?.map((part) => part.text)
    ?.join('\n')
    ?.slice(0, 1200),
}, null, 2))

const failures = []
if (!page?.ok) failures.push(page?.error ?? 'page flow failed')
if (page?.payloadText !== QUOTED) failures.push('Host-created selection payload text mismatch')
if (!page?.draft?.includes('[[quote:')) failures.push('quote chip missing before submit')
if (matching.length === 0) failures.push('actual Host request did not contain DSH_QUOTE')
if (!JSON.stringify(matching).includes(QUOTED)) failures.push('actual Host request did not contain the quoted text')
if (failures.length > 0) {
  console.error('HOST MESSAGE FAIL: ' + failures.join('; '))
  process.exit(1)
}
console.log('HOST MESSAGE PASS')
process.exit(0)
