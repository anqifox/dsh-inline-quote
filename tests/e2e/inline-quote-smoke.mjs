import { connect } from './cdp.mjs'

const { evaluate } = await connect()
const result = await evaluate(`(async () => {
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
  if (!ctx) return { ok: false, error: 'inline quote ctx missing' }
  const dismiss = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '开始使用')
  if (dismiss) dismiss.click()
  await new Promise((resolve) => setTimeout(resolve, 300))
  const dock = get()
  dock.inputActions.setDraft('测试前缀 ')
  await wait(() => get().input.draft === '测试前缀 ')
  const actx = ctx.sessions.scope(dock.sessionId)
  const caret = get().inputActions.captureInsertion()
  const payload = { v: 1, id: 'q_smoke', text: '完整引用文本', marker: 'q_smoke_marker', separator: 'inserted', kind: 'text' }
  payload.label = '完整引用文本'
  const reference = {
    source: 'quote',
    ref: window.__QUOTE_PROBE_ENCODE_REF__(payload),
    label: payload.label,
    clipboardText: '[[quote:q_smoke]]',
  }
  const applied = actx.bail(actx, 'slash/input-insert-reference', {
    reference,
    span: { start: caret.end, end: caret.end, draftRev: caret.draftRev },
  })
  await wait(() => get().input.occurrences.some((o) => o.clipboardText === '[[quote:q_smoke]]'))
  const occurrence = get().input.occurrences.find((o) => o.clipboardText === '[[quote:q_smoke]]')
  const controller = ctx.inputTriggers.sessionOf(actx)
  let serialized = null
  let serializeError = null
  try {
    serialized = await controller.serializeReference('quote', occurrence.ref, new AbortController().signal)
  } catch (error) {
    serializeError = error.message
  }
  return {
    ok: true,
    applied,
    draft: get().input.draft,
    occurrence: { source: occurrence.source, label: occurrence.label, offset: occurrence.offset, length: occurrence.length },
    serialized,
    serializeError,
    pluginLoaded: !!window.__QUOTE_PROBE_CTX__,
  }
})()`)
console.log(JSON.stringify(result, null, 2))
process.exit(0)

