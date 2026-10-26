import { connect } from './cdp.mjs'

const { evaluate } = await connect()
const script = "(async () => { const wait=async(fn,t=10000)=>{const s=Date.now();while(Date.now()-s<t){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}; const get=()=>window.__QUOTE_PROBE_DOCK__; const ctx=window.__QUOTE_PROBE_CTX__; get().inputActions.setDraft(''); await wait(()=>get().input.draft===''); window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'待卸载恢复的引用',kind:'text',lines:1}})); await wait(()=>get().input.occurrences.length===1); const occurrence=get().input.occurrences[0]; const sources=ctx.get('inputTriggers').live.sources; const index=sources.findIndex((source)=>source.name==='quote'); const removed=index>=0?sources.splice(index,1)[0]:null; const before=window.__QUOTE_PROBE_MOCK_SENT__.length; get().inputActions.submit(); await new Promise(r=>setTimeout(r,1200)); const after=window.__QUOTE_PROBE_MOCK_SENT__.length; const failed={sent:after-before,draft:get().input.draft,occurrences:get().input.occurrences.length,phase:get().input.phase,toast:[...document.querySelectorAll('[role=status]')].map(e=>e.innerText).join(' | ')}; if(removed) sources.splice(index,0,removed); const restored=await ctx.inputTriggers.sessionOf(ctx.sessions.scope(get().sessionId)).serializeReference('quote',occurrence.ref,new AbortController().signal).then(()=>true,()=>false); get().inputActions.setDraft(''); return {removed:!!removed,failed,restored}; })()"
const result = await evaluate(script)
console.log(JSON.stringify(result,null,2))
const failures=[]
if (!result.removed) failures.push('quote source was not present for unload simulation')
if (result.failed?.sent !== 0) failures.push('submission reached the Host after source unload')
if (!result.failed?.draft?.includes('[[quote:')) failures.push('draft text was not restored')
if (result.failed?.occurrences !== 1) failures.push('quote occurrence was not restored')
if (result.failed?.phase === 'submitting') failures.push('input remained in submitting phase')
if (!result.restored) failures.push('quote source did not resume after restore')
if (failures.length > 0) { console.error('UNLOAD FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('UNLOAD RECOVERY PASS')
process.exit(0)
