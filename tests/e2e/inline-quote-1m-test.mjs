import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=15000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  const text='X'.repeat(1000000)
  const payload={v:1,id:'q_1m',text,marker:'q_1m_marker',separator:'inserted',kind:'text',label:'1MB quote'}
  const ref=window.__QUOTE_PROBE_ENCODE_REF__(payload)
  const ctx=window.__QUOTE_PROBE_CTX__
  const actx=ctx.sessions.scope(get().sessionId)
  const caret=get().inputActions.captureInsertion()
  const t0=performance.now()
  const applied=actx.bail(actx,'slash/input-insert-reference',{reference:{source:'quote',ref,label:payload.label,clipboardText:'[[q_1m]]'},span:{start:caret.end,end:caret.end,draftRev:caret.draftRev}})
  const insertMs=performance.now()-t0
  await wait(()=>get().input.occurrences.length===1)
  const occ=get().input.occurrences[0]
  let persistError=null
  try { get().inputActions.persistDraft(); await new Promise(r=>setTimeout(r,800)) } catch(e) { persistError=e.message }
  const stored=localStorage.getItem('dsh.conversation.'+get().sessionId)
  return {applied,textLength:text.length,refLength:ref.length,insertMs,persistError,storedLength:stored?.length??0}
})()`)
console.log(JSON.stringify(result,null,2)); process.exit(0)

