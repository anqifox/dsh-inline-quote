import { connect } from './cdp.mjs'

const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  window.__QUOTE_PROBE_MOCK_SEND__ = true
  const wait = async (fn, timeout = 8000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const value = fn()
      if (value) return value
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('wait timeout')
  }
  const get = () => window.__QUOTE_PROBE_DOCK__
  const ctx = window.__QUOTE_PROBE_CTX__
  const encode = window.__QUOTE_PROBE_ENCODE_REF__
  const actx = ctx.sessions.scope(get().sessionId)
  const insertQuote = async (id, text) => {
    const caret = get().inputActions.captureInsertion()
    const payload = {
      v: 1, id, text, marker: 'm_' + id, separator: 'inserted', kind: 'text',
    }
    payload.label = text.slice(0, 20)
    const reference = { source: 'quote', ref: encode(payload), label: payload.label, clipboardText: '[[' + id + ']]' }
    const applied = actx.bail(actx, 'slash/input-insert-reference', {
      reference,
      span: { start: caret.end, end: caret.end, draftRev: caret.draftRev },
    })
    await wait(() => get().input.occurrences.some((o) => o.clipboardText === '[[' + id + ']]'))
    return applied
  }
  const insertText = async (text) => {
    const caret = get().inputActions.captureInsertion()
    get().inputActions.insertText(text, { start: caret.end, end: caret.end, draftRev: caret.draftRev })
    await wait(() => get().input.draft.endsWith(text))
  }

  get().inputActions.setDraft('我觉得 ')
  await wait(() => get().input.draft === '我觉得 ')
  await insertQuote('qA', '引用 A 的完整原文')
  await insertText(' 不错，但 ')
  await insertQuote('qB', '引用 B 的完整原文')
  await insertText(' 有问题。')
  const draft = get().input.draft
  const beforeSent = window.__QUOTE_PROBE_MOCK_SENT__.length
  get().inputActions.submit()
  const sent = await wait(() => window.__QUOTE_PROBE_MOCK_SENT__.length > beforeSent ? window.__QUOTE_PROBE_MOCK_SENT__[window.__QUOTE_PROBE_MOCK_SENT__.length - 1] : undefined)
  return {
    draft,
    sentCount: window.__QUOTE_PROBE_MOCK_SENT__.length,
    sent,
    draftAfter: get().input.draft,
  }
})()`)
console.log(JSON.stringify(result, null, 2))
const failures = []
if (!result.sent?.text?.includes('⟦DSH_QUOTE id=m_qA')) failures.push('quote A missing from Host-facing text')
if (!result.sent?.text?.includes('⟦DSH_QUOTE id=m_qB')) failures.push('quote B missing from Host-facing text')
if (!result.sent?.text?.includes('引用 A 的完整原文') || !result.sent?.text?.includes('引用 B 的完整原文')) failures.push('quote bodies missing')
if (result.draftAfter !== '') failures.push('draft not cleared after send')
if (failures.length > 0) { console.error('SEND FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('SEND PASS')
process.exit(0)

