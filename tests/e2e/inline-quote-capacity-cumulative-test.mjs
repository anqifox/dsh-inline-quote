import { connect } from './cdp.mjs'

const { evaluate } = await connect()
const script = `(async () => {
  window.__QUOTE_PROBE_MOCK_SEND__ = true
  const wait = async (fn, timeout = 20000) => {
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
  const status = () => [...document.querySelectorAll('[role=status]')].map((node) => node.innerText).join(' | ')
  const waitCapacity = () => wait(() => status().includes('草稿容量不足'))
  const waitNoStatus = async () => {
    const start = Date.now()
    while (Date.now() - start < 7000) {
      if (!document.querySelector('[role=status]')) return
      await sleep(100)
    }
  }
  const clear = async () => {
    try { localStorage.removeItem('dsh.conversation.' + get().sessionId) } catch {}
    try { localStorage.removeItem('inline-quote-capacity-ballast') } catch {}
    get().inputActions.setDraft('')
    await wait(() => get().input.draft === '')
    await waitNoStatus()
  }
  const insert = (text) => window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert', { detail: { text, kind: 'text' } }))
  const stored = () => localStorage.getItem('dsh.conversation.' + get().sessionId) || ''
  const hold = () => { try { localStorage.setItem('inline-quote-capacity-ballast', 'z'.repeat(2500000)) } catch {} }
  const release = () => { try { localStorage.removeItem('inline-quote-capacity-ballast') } catch {} }

  const report = {}
  await clear()
  insert('x'.repeat(2200000))
  await wait(() => get().input.occurrences.length === 1)
  await wait(() => stored().includes(get().input.occurrences[0].ref))
  const firstRef = get().input.occurrences[0].ref
  report.firstRefLength = firstRef.length

  hold()
  insert('y'.repeat(2200000))
  await waitCapacity()
  await wait(() => get().input.occurrences.length === 1)
  report.twoQuote = {
    occurrences: get().input.occurrences.length,
    draft: get().input.draft,
    status: status(),
    storedFirst: stored().includes(firstRef),
  }
  release()

  await clear()
  get().inputActions.setDraft('A')
  await wait(() => get().input.draft === 'A')
  hold()
  insert('q'.repeat(2200000))
  await waitCapacity()
  await wait(() => get().input.occurrences.length === 0)
  report.otherData = {
    occurrences: get().input.occurrences.length,
    draft: get().input.draft,
    status: status(),
    storedDraft: stored().includes('"text":"A"'),
    ballast: (() => { try { return localStorage.getItem('inline-quote-capacity-ballast')?.length ?? 0 } catch { return 0 } })(),
  }
  release()
  await clear()
  return report
})()`

const result = await evaluate(script)
console.log(JSON.stringify(result, null, 2))
const failures = []
if (!result.twoQuote || result.twoQuote.occurrences !== 1) failures.push('second quote was not rolled back')
if (!result.twoQuote?.storedFirst) failures.push('first quote was not preserved')
if (!result.twoQuote?.status?.includes('草稿容量不足')) failures.push('missing cumulative capacity error')
if (!result.otherData || result.otherData.occurrences !== 0) failures.push('quote was inserted despite other-draft storage pressure')
if (result.otherData?.draft !== 'A') failures.push('existing draft was not preserved under storage pressure')
if (!result.otherData?.storedDraft) failures.push('existing draft was not persisted under storage pressure')
if (result.otherData?.ballast !== 2500000) failures.push('unrelated draft data was lost')
if (failures.length > 0) {
  console.error('CAPACITY FAIL: ' + failures.join('; '))
  process.exit(1)
}
console.log('CAPACITY PASS')
process.exit(0)

