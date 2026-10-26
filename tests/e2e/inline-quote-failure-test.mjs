import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=10000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  const ctx=window.__QUOTE_PROBE_CTX__
  const actx=ctx.sessions.scope(get().sessionId)
  const caret=get().inputActions.captureInsertion()
  const applied=actx.bail(actx,'slash/input-insert-reference',{reference:{source:'quote',ref:'not-a-valid-ref',label:'bad',clipboardText:'[[bad]]'},span:{start:caret.end,end:caret.end,draftRev:caret.draftRev}})
  await wait(()=>get().input.occurrences.length===1)
  const before=window.__QUOTE_PROBE_MOCK_SENT__.length
  get().inputActions.submit()
  await new Promise(r=>setTimeout(r,1200))
  return {applied,beforeSent:before,afterSent:window.__QUOTE_PROBE_MOCK_SENT__.length,draft:get().input.draft,occurrences:get().input.occurrences.length,phase:get().input.phase}
})()`)
console.log(JSON.stringify(result,null,2))
const failures=[]
if (!result.applied) failures.push('invalid reference was not inserted')
if (result.afterSent !== result.beforeSent) failures.push('invalid reference reached the Host')
if (!result.draft?.includes('[[bad]]')) failures.push('draft was not restored')
if (result.occurrences !== 1) failures.push('occurrence was not restored')
if (result.phase === 'submitting') failures.push('input remained in submitting phase')
if (failures.length > 0) { console.error('FAILURE RECOVERY FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('FAILURE RECOVERY PASS')
process.exit(0)

