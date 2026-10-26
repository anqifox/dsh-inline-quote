import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=25000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'W'.repeat(3000000),kind:'text',lines:1}}))
  await wait(()=>get().input.occurrences.length===1)
  const occ=get().input.occurrences[0]
  const refLen=occ.ref.length
  get().inputActions.persistDraft()
  await new Promise(r=>setTimeout(r,800))
  const stored=localStorage.getItem('dsh.conversation.'+get().sessionId)
  return {occurrences:get().input.occurrences.length,refLen,storedLength:stored?.length??0,label:occ.label}
})()`)
console.log(JSON.stringify(result,null,2)); process.exit(0)

