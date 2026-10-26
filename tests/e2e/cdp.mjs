import fs from 'node:fs'
import WebSocket from 'ws'

const DEBUG = 'http://127.0.0.1:9224'

export async function connect() {
  const targets = await (await fetch(`${DEBUG}/json/list`)).json()
  const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:6610'))
  if (!page) throw new Error(`probe page target not found: ${JSON.stringify(targets.map((t) => [t.type, t.url]))}`)
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  let id = 0
  const pending = new Map()
  socket.on('message', (data) => {
    const message = JSON.parse(String(data))
    if (message.id === undefined) return
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id
    pending.set(next, { resolve, reject })
    socket.send(JSON.stringify({ id: next, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result?.value
  }
  return { socket, send, evaluate }
}

export async function waitFor(fn, timeoutMs = 20000, intervalMs = 250) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn()
      if (value) return value
      last = value
    } catch (error) {
      last = error
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`waitFor timeout; last=${last instanceof Error ? last.message : JSON.stringify(last)}`)
}

export function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

