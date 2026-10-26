import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=8000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  const ctx=window.__QUOTE_PROBE_CTX__
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  const insert=async()=>{window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'重复内容',kind:'text',lines:1}}));await new Promise(r=>setTimeout(r,300))}
  await insert(); await wait(()=>get().input.occurrences.length===1)
  await insert(); await wait(()=>get().input.occurrences.length===2)
  const actx=ctx.sessions.scope(get().sessionId); const controller=ctx.inputTriggers.sessionOf(actx)
  const parts=[]
  for(const o of get().input.occurrences){parts.push(await controller.serializeReference(o.source,o.ref,new AbortController().signal))}
  const markers=[...new Set(parts.map(p=>/id=([A-Za-z0-9_-]+)/.exec(p)?.[1]))]
  const before=window.__QUOTE_PROBE_MOCK_SENT__.length
  get().inputActions.submit()
  await wait(()=>window.__QUOTE_PROBE_MOCK_SENT__.length>before)
  const sent=window.__QUOTE_PROBE_MOCK_SENT__.at(-1)
  return {parts,markers,occurrences:get().input.occurrences.length,sentLength:sent.text.length,sent}
})()`)
console.log(JSON.stringify(result,null,2)); process.exit(0)

