window.__ModuleLoader__.load({
  id: '@local/dsh-quote-probe',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const formatQuoteText = (text) => text
      .replace(/\r\n?/gu, '\n')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')

    const encodeRef = (payload) => {
      const json = JSON.stringify(payload)
      const bytes = new TextEncoder().encode(json)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
    }

    const decodeRef = (ref) => {
      const base64 = ref.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      const binary = atob(padded)
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      return JSON.parse(new TextDecoder().decode(bytes))
    }

    function ProbeDock({ sessionId, input, inputActions }) {
      window.__QUOTE_PROBE_DOCK__ = { sessionId, input, inputActions }
      return h('div', {
        id: 'quote-probe-dock',
        style: { padding: '4px 8px', fontSize: 12, color: '#888' },
      }, `quote probe loaded · ${sessionId ?? 'no session'}`)
    }

    function ProbeResults() {
      const results = window.__QUOTE_PROBE_RESULTS__ ?? []
      return h('pre', {
        id: 'quote-probe-results',
        style: { whiteSpace: 'pre-wrap', fontSize: 12, color: '#333', margin: 0 },
      }, JSON.stringify(results, null, 2))
    }

    return {
      inject: ['slots', 'sessions', 'uiConversation', 'inputTriggers'],
      apply(ctx) {
        window.__QUOTE_PROBE_LOADED__ = true
        window.__QUOTE_PROBE_CTX__ = ctx
        window.__QUOTE_PROBE_SERVICES__ = {
          sessions: ctx.sessions,
          uiConversation: ctx.uiConversation,
          inputTriggers: ctx.inputTriggers,
        }
        window.__QUOTE_PROBE_FORMAT_QUOTE__ = formatQuoteText
        window.__QUOTE_PROBE_ENCODE_REF__ = encodeRef
        window.__QUOTE_PROBE_DECODE_REF__ = decodeRef
        window.__QUOTE_PROBE_MOCK_SENT__ = []

        window.__QUOTE_PROBE_MOCK_SEND__ ??= true
        ctx.inject(['conversation'], (scope) => {
          const conversation = scope.conversation
          if (conversation.__quoteProbeMock === true) return
          conversation.__quoteProbeMock = true
          const original = conversation.sendSession.bind(conversation)
          conversation.sendSession = async (session, text, ...rest) => {
            if (window.__QUOTE_PROBE_MOCK_SEND__ !== true) {
              return original(session, text, ...rest)
            }
            window.__QUOTE_PROBE_MOCK_SENT__.push({ sessionId: session.sessionId, text })
            return { kind: 'success' }
          }
        })

        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'quote-probe-input-dock',
          order: 99,
        }, ProbeDock))

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'quote-probe-results',
          order: 99,
        }, ProbeResults))
      },
    }
  },
})
