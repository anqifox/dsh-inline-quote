import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const ctx = window.__QUOTE_PROBE_CTX__
  const ui = window.__QUOTE_PROBE_SERVICES__.uiConversation
  const dock = window.__QUOTE_PROBE_DOCK__
  const actx = ctx.sessions.scope(dock.sessionId)
  const controller = ctx.inputTriggers.sessionOf(actx)
  const payload = { v: 1, id: 'q_parser', text: 'const x = 1\\n  return x', marker: 'q_parser_marker', separator: 'inserted', kind: 'code', language: 'ts', lines: 2 }
  const ref = window.__QUOTE_PROBE_ENCODE_REF__(payload)
  const serialized = await controller.serializeReference('quote', ref, new AbortController().signal)
  const text = '前缀 ' + serialized + ' 后缀'
  const evaluator = ui.userText.createEvaluator()
  const nodes = evaluator({ text, facts: {} })
  return { serialized, nodes: nodes.map(n => ({ id: n.id, start: n.start, end: n.end, data: n.data })) }
})()`)
console.log(JSON.stringify(result, null, 2))
const failures=[]
if (!result.serialized?.includes('kind=code')) failures.push('serialized kind missing')
if (!result.serialized?.includes('lang=ts')) failures.push('serialized language missing')
if (!result.serialized?.includes('lines=2')) failures.push('serialized lines missing')
if (!result.serialized?.includes('const x = 1\n  return x')) failures.push('serialized body missing')
const node=result.nodes?.find((item)=>item.id==='inline-quote')
if (!node) failures.push('inline-quote node missing')
if (node?.data?.text !== 'const x = 1\n  return x') failures.push('inline-quote node body mismatch')
if (failures.length > 0) { console.error('PARSER FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('PARSER PASS')
process.exit(0)

