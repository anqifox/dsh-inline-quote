import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=12000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const ctx=window.__QUOTE_PROBE_CTX__
  const dock=window.__QUOTE_PROBE_DOCK__
  const binding=ctx.sessions.binding(dock.sessionId)
  if(!binding) return {ok:false,error:'no binding'}
  const session=binding.session
  const actx=ctx.sessions.scope(dock.sessionId)
  const controller=ctx.inputTriggers.sessionOf(actx)
  const marker='q_sent_marker_'+Date.now()
  const unique='这是已发送消息里的引用原文。'+marker
  const payload={v:1,id:'q_sent_'+Date.now(),text:unique,marker,separator:'inserted',kind:'text',label:'已发送引用'}
  const serialized=await controller.serializeReference('quote',window.__QUOTE_PROBE_ENCODE_REF__(payload),new AbortController().signal)
  const sub=session.beginSubmission({mode:'queue',text:'前缀 '+serialized+' 后缀',attachments:[],onRetire(){}})
  const chip=await wait(()=>[...document.querySelectorAll('[data-inline-quote-sent]')].find((node)=>node.innerText.includes(unique)))
  const textBefore=chip.innerText
  chip.click()
  await new Promise(r=>setTimeout(r,400))
  const dialog=document.querySelector('[data-inline-quote-preview]')
  const preview=dialog?.innerText?.slice(0,400)??null
  dialog?.querySelector('button[aria-label="关闭"]')?.click()
  sub.abandon()
  await new Promise(r=>setTimeout(r,500))
  const still=[...document.querySelectorAll('[data-inline-quote-sent]')].some((node)=>node.innerText.includes(unique))
  return {ok:true,serialized,chipText:textBefore,preview,stillAfterAbandon:still}
})()`)
console.log(JSON.stringify(result,null,2))
const failures=[]
if (!result.ok) failures.push(result.error || 'sent render failed')
if (!result.chipText?.includes('这是已发送消息里的引用原文。')) failures.push('sent quote chip text missing')
if (!result.preview?.includes('这是已发送消息里的引用原文。')) failures.push('sent quote preview body missing')
if (result.stillAfterAbandon) failures.push('sent quote chip remained after abandon')
if (failures.length > 0) { console.error('SENT RENDER FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('SENT RENDER PASS')
process.exit(0)

