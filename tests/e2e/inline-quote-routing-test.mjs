import { connect } from './cdp.mjs'

const { evaluate } = await connect()
const script = "(async () => { const wait = async (fn, timeout = 8000) => { const start = Date.now(); while (Date.now() - start < timeout) { const value = fn(); if (value) return value; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error('wait timeout'); }; const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); const get = () => window.__QUOTE_PROBE_DOCK__; get().inputActions.setDraft(''); await wait(() => get().input.draft === ''); const host = document.querySelector('[data-chat-flow]') || document.querySelector('[data-conversation-scroll]'); const realRoot = host.closest('[data-conversation-session]'); const realSeat = realRoot.querySelector('[data-composer-seat]'); const realComposerId = realSeat.getAttribute('data-inline-quote-composer'); const fakeRoot = document.createElement('div'); fakeRoot.setAttribute('data-conversation-session', 'fake-session'); const fakeSeat = document.createElement('div'); fakeSeat.setAttribute('data-composer-seat', ''); fakeSeat.setAttribute('data-inline-quote-composer', 'qb_fake_target'); fakeRoot.appendChild(fakeSeat); const fakeRow = document.createElement('div'); fakeRow.setAttribute('data-chat-flow-kind', 'assistant-step'); fakeRow.innerHTML = '<p>fake target quote</p>'; fakeRoot.appendChild(fakeRow); document.body.appendChild(fakeRoot); const selectRow = async (row) => { const range = document.createRange(); range.selectNodeContents(row); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange')); await sleep(400); }; const clickQuote = async () => { const button = [...document.querySelectorAll('button')].find((item) => (item.innerText || '').trim() === '引用'); if (!button) return false; button.click(); await sleep(500); return true; }; await selectRow(fakeRow); const fakeButton = await clickQuote(); const fakeOccurrences = get().input.occurrences.length; fakeRoot.remove(); window.getSelection()?.removeAllRanges(); const realRow = document.createElement('div'); realRow.setAttribute('data-chat-flow-kind', 'assistant-step'); realRow.innerHTML = '<p>real target quote</p>'; host.appendChild(realRow); await selectRow(realRow); const realButton = await clickQuote(); await wait(() => get().input.occurrences.length === 1); const occurrence = get().input.occurrences[0]; const payload = window.__QUOTE_PROBE_DECODE_REF__(occurrence.ref); realRow.remove(); window.getSelection()?.removeAllRanges(); get().inputActions.setDraft(''); return { realComposerId, fakeButton, fakeOccurrences, realButton, realOccurrences: get().input.occurrences.length, payloadComposerId: payload.composerId, payloadSessionId: payload.sessionId, payloadText: payload.text }; })()"
const result = await evaluate(script)
console.log(JSON.stringify(result, null, 2))
const failures = []
if (!result.realComposerId) failures.push('real composer id missing')
if (!result.fakeButton) failures.push('quote button missing on first target')
if (result.fakeOccurrences !== 0) failures.push('stub target inserted into real composer')
if (!result.realButton) failures.push('quote button missing on real target')
if (result.realOccurrences !== 1) failures.push('real target did not insert exactly once')
if (result.payloadComposerId !== result.realComposerId) failures.push('payload composer target mismatch')
if (result.payloadText !== 'real target quote') failures.push('payload text mismatch')
if (failures.length > 0) { console.error('ROUTING FAIL: ' + failures.join('; ')); process.exit(1) }
// The negative target check above uses a synthetic seat because the isolated
// page mounts exactly one real conversation bridge. Do not report this as a
// PASS for simultaneous real-ComposerBridge routing.
console.log('ROUTING UNVERIFIED: second target is synthetic; real dual-ComposerBridge mount unavailable in this isolated layout')
process.exit(2)
