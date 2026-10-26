import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=12000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'Z'.repeat(4000000),kind:'text',lines:1}}))
  await new Promise(r=>setTimeout(r,1200))
  const toast=[...document.querySelectorAll('[role="status"]')].map(e=>e.innerText).join(' | ')
  return {occurrences:get().input.occurrences.length,draft:get().input.draft,toast}
})()`)
console.log(JSON.stringify(result,null,2))
const failures=[]
if (result.occurrences !== 0) failures.push('oversized quote was inserted')
if (!result.toast?.includes('引用过长')) failures.push('missing too-large error')
if (failures.length > 0) { console.error('CAPACITY GUARD FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('CAPACITY GUARD PASS')
process.exit(0)

