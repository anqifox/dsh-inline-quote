import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=8000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  const ctx=window.__QUOTE_PROBE_CTX__
  const actx=ctx.sessions.scope(get().sessionId)
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  const insertRaw=async(reference)=>{const caret=get().inputActions.captureInsertion();return actx.bail(actx,'slash/input-insert-reference',{reference,span:{start:caret.end,end:caret.end,draftRev:caret.draftRev}})}
  const fileApplied=await insertRaw({source:'file',ref:'probe-file',label:'probe.txt',clipboardText:'@probe.txt'})
  await wait(()=>get().input.occurrences.length===1)
  window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'与文件共存',kind:'text',lines:1}}))
  await wait(()=>get().input.occurrences.length===2)
  const before={draft:get().input.draft,sources:get().input.occurrences.map(o=>o.source)}
  const quote=get().input.occurrences.find(o=>o.source==='quote')
  const payload=window.__QUOTE_PROBE_DECODE_REF__(quote.ref)
  window.dispatchEvent(new CustomEvent('dsh-inline-quote:delete',{detail:{id:payload.id}}))
  await wait(()=>get().input.occurrences.length===1)
  return {fileApplied,before,after:{draft:get().input.draft,sources:get().input.occurrences.map(o=>o.source)}}
})()`)
console.log(JSON.stringify(result,null,2)); process.exit(0)

