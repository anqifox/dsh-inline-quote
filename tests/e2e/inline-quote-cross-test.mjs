import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=10000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  const ctx=window.__QUOTE_PROBE_CTX__
  const ui=ctx.get('uiWorkspace')
  const current=get().sessionId
  const ids=ctx.sessions.list.getSnapshot().ids
  const a=ids.find((id)=>id!==current)
  if(!a) return {ok:false,error:'no second session',current}
  const refA=ctx.sessions.retain(a,{source:'inline-quote-test'}); await refA.ready
  const insert=async(text)=>{window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text,kind:'text',lines:1}}));await new Promise(r=>setTimeout(r,500))}
  get().inputActions.setDraft(''); await wait(()=>get().input.draft==='')
  await insert('B 会话引用')
  await wait(()=>get().input.occurrences.length===1)
  const bDraft=get().input.draft
  ui.openSession(a); await wait(()=>get().sessionId===a)
  get().inputActions.setDraft(''); await wait(()=>get().input.draft==='')
  await insert('A 会话引用')
  await wait(()=>get().input.occurrences.length===1)
  const aDraft=get().input.draft
  ui.openSession(current); await wait(()=>get().sessionId===current)
  const bAfter=get().input.draft
  refA.release()
  return {ok:true,a,current,bDraft,aDraft,bAfter,bHasA:bAfter.includes('A 会话引用'),aHasB:aDraft.includes('B 会话引用')}
})()`)
console.log(JSON.stringify(result,null,2))
const failures=[]
if (!result.ok) failures.push(result.error || 'cross-session setup failed')
if (result.a === result.current) failures.push('target session is the current session')
if (result.bHasA) failures.push('session B draft contains session A quote')
if (result.aHasB) failures.push('session A draft contains session B quote')
if (!result.aDraft?.includes('[[quote:')) failures.push('session A quote missing')
if (!result.bAfter?.includes('[[quote:')) failures.push('session B quote was not preserved after switch')
if (failures.length > 0) { console.error('CROSS FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('CROSS PASS')
process.exit(0)

