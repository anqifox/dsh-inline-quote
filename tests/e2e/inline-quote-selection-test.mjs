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
  get().inputActions.setDraft('')
  await wait(() => get().input.draft === '')
  const host = document.querySelector('[data-chat-flow]') || document.querySelector('[data-conversation-scroll]') || document.body
  const row = document.createElement('div')
  row.setAttribute('data-chat-flow-kind', 'user')
  row.setAttribute('data-chat-turn', '1')
  row.setAttribute('data-chat-node-key', 'probe-row')
  row.innerHTML = '<p>请引用这段文字，看看是否会出现在输入框里。</p>'
  host.appendChild(row)
  const paragraph = row.querySelector('p')
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  await new Promise((resolve) => setTimeout(resolve, 500))
  const quoteButton = [...document.querySelectorAll('button')].find((button) => (button.innerText || '').trim() === '引用')
  const buttonFound = !!quoteButton
  if (quoteButton) quoteButton.click()
  const after = await wait(() => get().input.occurrences.length === 1 ? get().input : undefined)
  const occurrence = after.occurrences[0]
  let payload = null
  try { payload = window.__QUOTE_PROBE_DECODE_REF__(occurrence.ref) } catch (error) { payload = { error: error.message } }
  const chip = document.querySelector('[data-composer-chip="quote"]')
  let preview = null
  if (chip) {
    chip.click()
    await new Promise((resolve) => setTimeout(resolve, 400))
    const dialog = document.querySelector('[data-inline-quote-preview]')
    preview = dialog ? {
      text: dialog.innerText,
      deleteButton: !![...dialog.querySelectorAll('button')].find((button) => (button.innerText || '').trim() === '删除引用'),
    } : null
  }
  row.remove()
  window.getSelection()?.removeAllRanges()
  return {
    buttonFound,
    draft: after.draft,
    payload,
    preview,
    chipFound: !!chip,
  }
})()`)
console.log(JSON.stringify(result, null, 2))
const failures = []
if (!result.buttonFound) failures.push('quote button missing')
if (!result.chipFound) failures.push('quote chip missing')
if (result.payload?.v !== 1) failures.push('quote payload missing')
if (result.payload?.text !== '请引用这段文字，看看是否会出现在输入框里。') failures.push('payload text mismatch')
if (!result.preview?.deleteButton) failures.push('preview delete action missing')
if (failures.length > 0) { console.error('SELECTION FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('SELECTION PASS')
process.exit(0)


