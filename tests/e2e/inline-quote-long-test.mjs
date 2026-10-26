import { connect } from './cdp.mjs'

const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait = async (fn, timeout = 12000) => {
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
  get().inputActions.setDraft('')
  await wait(() => get().input.draft === '')
  const lines = []
  for (let index = 0; index < 2000; index += 1) {
    lines.push('  const value' + index + ' = compute(' + index + ', "long quoted code line")')
  }
  const text = 'function huge() {\\n' + lines.join('\\n') + '\\n}'
  const payload = {
    v: 1,
    id: 'q_long',
    text,
    marker: 'q_long_marker_' + text.length,
    separator: 'inserted',
    kind: 'code',
    language: 'ts',
    lines: text.split('\\n').length,
    label: 'ts · ' + text.split('\\n').length + ' 行 · long code',
  }
  const reference = {
    source: 'quote',
    ref: encode(payload),
    label: payload.label,
    clipboardText: '[[quote:q_long]]',
  }
  const actx = ctx.sessions.scope(get().sessionId)
  const caret = get().inputActions.captureInsertion()
  const started = performance.now()
  const applied = actx.bail(actx, 'slash/input-insert-reference', {
    reference,
    span: { start: caret.end, end: caret.end, draftRev: caret.draftRev },
  })
  const insertMs = performance.now() - started
  await wait(() => get().input.occurrences.length === 1)
  const occurrence = get().input.occurrences[0]
  const refLength = occurrence.ref.length
  const persistStarted = performance.now()
  get().inputActions.persistDraft()
  await new Promise((resolve) => setTimeout(resolve, 500))
  const persistMs = performance.now() - persistStarted
  const key = 'dsh.conversation.' + get().sessionId
  const stored = localStorage.getItem(key)
  const controller = ctx.inputTriggers.sessionOf(actx)
  const serialized = await controller.serializeReference('quote', occurrence.ref, new AbortController().signal)
  return {
    applied,
    textLength: text.length,
    refLength,
    insertMs,
    persistMs,
    storedLength: stored?.length ?? 0,
    draftLength: get().input.draft.length,
    serializedLength: serialized.length,
    occurrence: { source: occurrence.source, label: occurrence.label, offset: occurrence.offset, length: occurrence.length },
    serializedStart: serialized.slice(0, 160),
    serializedEnd: serialized.slice(-80),
  }
})()`)
console.log(JSON.stringify(result, null, 2))
process.exit(0)

