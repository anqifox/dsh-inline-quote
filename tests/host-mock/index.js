import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const LOG_PATH = process.env.INLINE_QUOTE_HOST_LOG
  ?? join(tmpdir(), 'inline-quote-host-requests.jsonl')

const writeLog = (entry) => {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true })
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch {
    // Test instrumentation must not break the Host.
  }
}

class MockAdapter {
  providerInfo(provider) {
    return { id: provider, name: 'Inline Quote Mock' }
  }

  providerRetryPolicy() {}

  imageRequestPricing() {}

  imageRequestTarget(_provider, _model, image) {
    return { width: image.width, height: image.height, maxBytes: image.bytes }
  }

  async listModels(provider) {
    return [{
      provider,
      id: 'mock-1',
      name: 'Mock 1',
      description: 'Local deterministic Host mock for inline-quote acceptance.',
      contextWindow: 128000,
      maxTokens: 4096,
    }]
  }

  async resolveModel(provider, model) {
    return {
      provider,
      id: model,
      name: 'Mock 1',
      context: { contextWindow: 128000 },
      defaultMaxTokens: 4096,
    }
  }

  async prepareCall(provider, model) {
    return {
      model: await this.resolveModel(provider, model),
      stream: (options) => this.stream(options),
    }
  }

  async *stream(options) {
    writeLog({
      at: new Date().toISOString(),
      provider: options.provider,
      model: options.model,
      messages: options.messages,
    })
    const text = 'Mock Host response for inline-quote acceptance.'
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

export const inject = ['llm']

export function apply(ctx) {
  ctx.llm.registerAdapter(['inline-quote-mock'], new MockAdapter())
}
