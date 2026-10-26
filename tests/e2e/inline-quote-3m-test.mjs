import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=20000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  const text='Y'.repeat(3000000)
  const payload={v:1,id:'q_3m',text,marker:'q_3m_marker',separator:'inserted',kind:'text',label:'3MB quote'}
  const ref=window.__QUOTE_PROBE_ENCODE_REF__(payload)
  const ctx=window.__QUOTE_PROBE_CTX__
  const actx=ctx.sessions.scope(get().sessionId)
  const caret=get().inputActions.captureInsertion()
  const applied=actx.bail(actx,'slash/input-insert-reference',{reference:{source:'quote',ref,label:payload.label,clipboardText:'[[q_3m]]'},span:{start:caret.end,end:caret.end,draftRev:caret.draftRev}})
  await wait(()=>get().input.occurrences.length===1)
  let persistError=null
  try { get().inputActions.persistDraft(); await new Promise(r=>setTimeout(r,800)) } catch(e) { persistError=e.name+': '+e.message }
  const stored=localStorage.getItem('dsh.conversation.'+get().sessionId)
  return {applied,textLength:text.length,refLength:ref.length,persistError,storedLength:stored?.length??0}
})()`)
console.log(JSON.stringify(result,null,2)); process.exit(0)

