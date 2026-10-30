import { connect } from './cdp.mjs'

// Synthetic Trajectory DOM, real DSH Client composer/bridge. This proves DOM
// admission/insertion, NOT native Trajectory integration or actual Host sending.
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
  const wait = async (fn, timeout = 8000) => {
    const begin = Date.now()
    while (Date.now() - begin < timeout) {
      const value = fn()
      if (value) return value
      await delay(100)
    }
    throw new Error('trajectory test timeout')
  }
  const dock = () => window.__QUOTE_PROBE_DOCK__
  await wait(() => dock()?.inputActions && window.__QUOTE_PROBE_DECODE_REF__)
  dock().inputActions.setDraft('')
  await wait(() => dock().input.draft === '' && dock().input.occurrences.length === 0)

  const conversation = [...document.querySelectorAll('[data-conversation-session]')]
    .find(node => node.querySelector('[data-inline-quote-composer]'))
  if (!conversation) throw new Error('No active quote composer in conversation')
  const scroll = conversation.querySelector('[data-conversation-scroll]')
  if (!scroll) throw new Error('No conversation scroll region')

  const fixture = document.createElement('div')
  fixture.setAttribute('data-conversation-composer-overlay', '')
  fixture.setAttribute('data-inline-quote-trajectory-fixture', '')
  fixture.innerHTML = [
    '<section data-trajectory-row-key="fixture-1"><p>TRACE_ALPHA first result</p></section>',
    '<section data-trajectory-row-key="fixture-2"><p>TRACE_BETA second result</p></section>',
    '<section data-trajectory-row-key="fixture-3"><p>TRACE_GAMMA third result</p></section>',
    '<section data-trajectory-row-key="fixture-4"><pre><code class="language-js">const value = 42</code></pre></section>',
  ].join('')
  scroll.appendChild(fixture)
  const rows = [...fixture.querySelectorAll('section')]
  const select = (startNode, endNode) => {
    const range = document.createRange()
    range.setStart(startNode, 0)
    range.setEnd(endNode, endNode.textContent.length)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }
  const button = async () => wait(() => [...document.querySelectorAll('button')]
    .find(b => (b.innerText || '').trim() === '引用'))
  const errors = []
  let multiple = null
  let code = null
  try {
    select(rows[0].querySelector('p').firstChild, rows[2].querySelector('p').firstChild)
    const multiButton = await button()
    multiButton.click()
    const input = await wait(() => dock().input.occurrences.length === 1 ? dock().input : null)
    multiple = window.__QUOTE_PROBE_DECODE_REF__(input.occurrences[0].ref)
    const text = multiple.text || ''
    const a = text.indexOf('TRACE_ALPHA')
    const b = text.indexOf('TRACE_BETA')
    const c = text.indexOf('TRACE_GAMMA')
    if (!(a >= 0 && b > a && c > b)) errors.push('cross-record text missing or reordered')
    for (const token of ['TRACE_ALPHA', 'TRACE_BETA', 'TRACE_GAMMA']) {
      if (text.split(token).length !== 2) errors.push('duplicate/missing token: ' + token)
    }
    if (text.includes('const value = 42')) errors.push('unselected fourth row included')
    if (multiple.kind !== 'text' || multiple.source?.view !== 'trajectory') errors.push('wrong cross-row metadata')

    // A single selected code block should retain code semantics.
    select(rows[3].querySelector('code').firstChild, rows[3].querySelector('code').firstChild)
    const codeButton = await button()
    codeButton.click()
    const second = await wait(() => dock().input.occurrences.length === 2 ? dock().input : null)
    code = window.__QUOTE_PROBE_DECODE_REF__(second.occurrences[1].ref)
    if (code.text !== 'const value = 42' || code.kind !== 'code' || code.language !== 'js') {
      errors.push('single-code selection content/metadata mismatch')
    }
  } finally {
    window.getSelection()?.removeAllRanges()
    fixture.remove()
    dock().inputActions.setDraft('')
  }
  return {
    errors,
    multiple: multiple && { kind: multiple.kind, source: multiple.source, text: multiple.text },
    code: code && { kind: code.kind, language: code.language, text: code.text },
  }
})()`)
console.log(JSON.stringify(result, null, 2))
if (result.errors?.length) {
  console.error('TRAJECTORY SELECTION FAIL: ' + result.errors.join('; '))
  process.exit(1)
}
console.log('TRAJECTORY SELECTION PASS (synthetic view / real composer; Host not exercised)')
process.exit(0)
