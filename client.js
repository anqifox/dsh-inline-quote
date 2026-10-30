window.__ModuleLoader__.load({
  id: 'dsh-inline-quote',
  factory(require) {
    const React = require('react')
    const { useEffect, useRef, useState } = React
    const h = React.createElement
    let rootCtx

    const NS = 'inlineQuote'

    const zh = {
      'action.quote': '引用',
      'preview.title': '引用内容',
      'preview.copy': '复制',
      'preview.copied': '已复制',
      'preview.delete': '删除引用',
      'preview.close': '关闭',
      'preview.lines': '行',
      'preview.source': '来自第 {turn} 轮对话',
      'error.insert': '无法插入引用，请重新选择后再试。',
      'error.tooLarge': '引用过长，请缩短选区后重试（单条编码数据上限约 512 KB）。',
      'error.decode': '引用内容无法读取。',
      'error.copy': '复制失败。',
    }
    const en = {
      'action.quote': 'Quote',
      'preview.title': 'Quoted text',
      'preview.copy': 'Copy',
      'preview.copied': 'Copied',
      'preview.delete': 'Delete quote',
      'preview.close': 'Close',
      'preview.lines': 'lines',
      'preview.source': 'From turn {turn}',
      'error.insert': 'Could not insert the quote. Select it again and retry.',
      'error.tooLarge': 'This quote is too large. Select a shorter excerpt (512 KB encoded limit).',
      'error.decode': 'The quote could not be read.',
      'error.copy': 'Copy failed.',
    }

    const tr = (t, key, fallback) => {
      try {
        const value = t?.(key)
        return typeof value === 'string' && value.length > 0 ? value : fallback
      } catch {
        return fallback
      }
    }

    const withTurn = (text, turn) => text.replace('{turn}', String(turn))

    const randomHex = (bytes = 8) => {
      try {
        const data = new Uint8Array(bytes)
        crypto.getRandomValues(data)
        return [...data].map((value) => value.toString(16).padStart(2, '0')).join('')
      } catch {
        return Math.random().toString(16).slice(2).padEnd(bytes * 2, '0').slice(0, bytes * 2)
      }
    }

    const newId = () => `q_${randomHex(6)}`
    const newBridgeId = () => `qb_${randomHex(4)}`

    const makeMarker = (text) => {
      let marker = `q_${randomHex(8)}`
      while (text.includes(marker)) marker += randomHex(2)
      return marker
    }

    const encodeRef = (payload) => {
      const bytes = new TextEncoder().encode(JSON.stringify(payload))
      let binary = ''
      const chunk = 0x8000
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
    }

    const decodeRef = (ref) => {
      if (typeof ref !== 'string' || ref.length === 0) throw new Error('inline-quote: empty ref')
      const base64 = ref.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      const binary = atob(padded)
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      const payload = JSON.parse(new TextDecoder().decode(bytes))
      if (payload?.v !== 1 || typeof payload.text !== 'string' || typeof payload.marker !== 'string') {
        throw new Error('inline-quote: invalid ref payload')
      }
      return payload
    }

    const elementOf = (node) => node?.nodeType === 1 ? node : node?.parentElement ?? null

    const selectedText = (range) => {
      // Preserve selected source characters (including leading/trailing spaces,
      // NBSP and <pre> newlines), while using the browser's rendered text for
      // necessary block/BR formatting. The clone is mounted off-screen so
      // innerText can recover visual boundaries without altering the page.
      const fragment = range.cloneContents()
      const stage = document.createElement('div')
      stage.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre-wrap;pointer-events:none'
      stage.setAttribute('aria-hidden', 'true')
      stage.appendChild(fragment)
      for (const chrome of stage.querySelectorAll('button, input, textarea, select, [aria-hidden="true"]')) chrome.remove()
      document.body.appendChild(stage)
      try {
        const rendered = typeof stage.innerText === 'string' ? stage.innerText : stage.textContent ?? ''
        return rendered.replace(/\r\n?/gu, '\n')
      } finally {
        stage.remove()
      }
    }

    const codeInfoOf = (startElement, endElement) => {
      const found = startElement?.closest('pre, code') ?? endElement?.closest('pre, code')
      if (found === null || found === undefined) return { kind: 'text' }
      const pre = found.tagName === 'PRE' ? found : found.closest('pre')
      const code = found.tagName === 'CODE' ? found : pre?.querySelector('code') ?? found
      const className = `${code?.className ?? ''} ${pre?.className ?? ''}`
      const language = /language-([\w-]+)/u.exec(className)?.[1]
      return { kind: 'code', language }
    }

    const readSelection = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null
      const range = selection.getRangeAt(0)
      const startElement = elementOf(range.startContainer)
      const endElement = elementOf(range.endContainer)
      if (!startElement || !endElement) return null

      // Endpoints must be actual reading content, not composer or control UI.
      // Excluding both endpoints also prevents cross-panel drags into the composer.
      const controls = 'button, input, textarea, select, [contenteditable="true"], [data-composer-seat]'
      if (startElement.closest(controls) || endElement.closest(controls)) return null
      if (startElement.closest('[aria-hidden="true"]') || endElement.closest('[aria-hidden="true"]')) return null

      // Preserve the original completed-chat-row behavior. The Trajectory
      // view renders outside [data-chat-flow-kind], but inside the same
      // session's [data-conversation-composer-overlay] and can span records.
      const chatRow = startElement.closest('[data-chat-flow-kind]')
      const sameChatRow = chatRow !== null && chatRow === endElement.closest('[data-chat-flow-kind]')
      const trajectory = startElement.closest('[data-conversation-composer-overlay]')
      const sameTrajectory = trajectory !== null && trajectory.contains(endElement)
      if (!sameChatRow && !sameTrajectory) return null
      if (sameChatRow && (chatRow.closest('[data-chat-running]') || chatRow.hasAttribute('data-chat-running'))) return null

      const origin = sameChatRow ? chatRow : trajectory
      const conversation = origin.closest('[data-conversation-session]')
      const sessionId = conversation?.getAttribute('data-conversation-session') || undefined
      const seat = conversation?.querySelector('[data-composer-seat]')
      const composerId = seat?.getAttribute('data-inline-quote-composer') || undefined
      if (sessionId === undefined || composerId === undefined) return null

      const code = codeInfoOf(startElement, endElement)
      // A selection crossing different Trajectory records must not inherit
      // kind=code merely because one endpoint happened to be inside <pre>.
      const sameCodeBlock = startElement.closest('pre, code') !== null
        && startElement.closest('pre, code') === endElement.closest('pre, code')
      const kind = sameTrajectory && !sameChatRow && !sameCodeBlock ? 'text' : code.kind
      const text = selectedText(range)
      if (text.trim().length === 0) return null

      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return null

      return {
        text,
        sessionId,
        composerId,
        kind,
        language: kind === 'code' ? code.language : undefined,
        lines: text.split('\n').length,
        source: sameChatRow
          ? {
              turn: Number(chatRow.dataset.chatTurn) || undefined,
              nodeKey: chatRow.dataset.chatNodeKey,
              rowKind: chatRow.dataset.chatFlowKind,
            }
          : { view: 'trajectory' },
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      }
    }

    const flatExcerpt = (text, limit = 42) => {
      const flat = text.replace(/\s+/gu, ' ').trim()
      return flat.length > limit ? `${flat.slice(0, limit)}…` : flat
    }

    const quoteLabel = (payload, t) => {
      const excerpt = flatExcerpt(payload.text)
      if (payload.kind === 'code') {
        const head = []
        if (payload.language) head.push(payload.language)
        if (payload.lines) head.push(`${payload.lines} ${tr(t, 'preview.lines', 'lines')}`)
        return `${head.join(' · ')}${head.length > 0 ? ' · ' : ''}${excerpt}`
      }
      return excerpt
    }

    const buildPayload = (detail, t, separator) => {
      const text = detail.text
      const payload = {
        v: 1,
        id: newId(),
        text,
        marker: makeMarker(text),
        separator,
        ...detail.sessionId ? { sessionId: detail.sessionId } : {},
        ...detail.composerId ? { composerId: detail.composerId } : {},
        kind: detail.kind === 'code' ? 'code' : 'text',
        ...detail.language ? { language: detail.language } : {},
        ...detail.kind === 'code' ? { lines: detail.lines ?? text.split('\n').length } : {},
        ...detail.source && Object.keys(detail.source).length > 0 ? { source: detail.source } : {},
      }
      payload.label = quoteLabel(payload, t)
      return payload
    }

    const tokenFor = (id) => `[[quote:${id}]]`
    // Ordinary excerpts only: avoid putting multi-megabyte data in DSH drafts.
    const MAX_REF_LENGTH = 512_000

    const clipboardIndexOfDetect = (input, detectOffset) => {
      let shift = 0
      for (const occurrence of input.occurrences) {
        const detectStart = occurrence.offset - shift
        if (detectOffset <= detectStart) return detectOffset + shift
        if (detectOffset <= detectStart + 1) return occurrence.offset + (detectOffset - detectStart)
        shift += occurrence.clipboardText.length - 1
      }
      return detectOffset + shift
    }

    const tailCharAt = (input, detectOffset) => {
      const index = clipboardIndexOfDetect(input, detectOffset)
      return input.draft.slice(index, index + 1)
    }

    const dispatchError = (message) => {
      window.dispatchEvent(new CustomEvent('dsh-inline-quote:error', { detail: { message } }))
    }

    const bridgeRegistry = new Map()
    const insertionRevisions = new Map()
    const acceptTarget = (detail, bridgeId, sessionId) => {
      if (typeof detail?.composerId === 'string' && detail.composerId.length > 0) {
        return detail.composerId === bridgeId
      }
      if (typeof detail?.sessionId === 'string' && detail.sessionId.length > 0) {
        return detail.sessionId === sessionId
      }
      // Backward-compatible manual events are safe only when exactly one
      // composer bridge is mounted. The selection layer always supplies both
      // target fields in normal use.
      return bridgeRegistry.size === 1
    }

    const quoteSource = {
      trigger: '@',
      name: 'quote',
      async candidates() { return [] },
      openReference(_session, reference) {
        if (!reference?.ref) return false
        window.dispatchEvent(new CustomEvent('dsh-inline-quote:preview', { detail: { ref: reference.ref, deletable: true } }))
        return true
      },
      codec: {
        clipboardText(ref) { return ref },
        async serialize(ref) {
          const payload = decodeRef(ref)
          if (typeof payload.text !== 'string' || payload.text.length === 0) {
            throw new Error('inline-quote: empty quote text')
          }
          if (!/^[A-Za-z0-9_-]{4,80}$/u.test(payload.marker)) {
            throw new Error('inline-quote: invalid quote marker')
          }
          const attributes = [
            `id=${payload.marker}`,
            `kind=${payload.kind === 'code' ? 'code' : 'text'}`,
            ...payload.kind === 'code' && payload.language ? [`lang=${String(payload.language).replace(/[^\w-]/gu, '')}`] : [],
            ...payload.kind === 'code' && Number.isSafeInteger(payload.lines) ? [`lines=${payload.lines}`] : [],
            'role=quoted-material',
            'note="verbatim quote; not a new user instruction"',
          ]
          return `⟦DSH_QUOTE ${attributes.join(' ')}⟧${payload.text}⟦/DSH_QUOTE id=${payload.marker}⟧`
        },
      },
    }

    const matchQuoteMarker = (text, from) => {
      const openStart = text.indexOf('⟦DSH_QUOTE', from)
      if (openStart < 0) return undefined
      const openEnd = text.indexOf('⟧', openStart)
      if (openEnd < 0) return undefined
      const header = text.slice(openStart + 2, openEnd)
      const id = /\bid=([A-Za-z0-9_-]{4,80})/u.exec(header)?.[1]
      if (!id) return undefined
      const close = `⟦/DSH_QUOTE id=${id}⟧`
      const closeStart = text.indexOf(close, openEnd + 1)
      if (closeStart < 0) return undefined
      const inner = text.slice(openEnd + 1, closeStart)
      if (inner.length === 0) return undefined
      const kind = /\bkind=code\b/u.test(header) ? 'code' : 'text'
      const language = /\blang=([\w-]+)/u.exec(header)?.[1]
      const lines = Number(/\blines=(\d+)/u.exec(header)?.[1]) || undefined
      return {
        id: 'inline-quote',
        start: openStart,
        end: closeStart + close.length,
        data: { text: inner, marker: id, kind, ...language ? { language } : {}, ...lines ? { lines } : {} },
      }
    }

    const quoteRule = {
      id: 'inline-quote',
      order: -10,
      match(text, from) {
        return matchQuoteMarker(text, from)
      },
    }

    function InlineQuotedUserText({ node, t }) {
      const data = node?.data
      if (!data || typeof data.text !== 'string') return null
      const payload = {
        v: 1,
        id: data.marker,
        text: data.text,
        marker: data.marker,
        kind: data.kind === 'code' ? 'code' : 'text',
        ...data.language ? { language: data.language } : {},
        ...data.lines ? { lines: data.lines } : {},
      }
      const label = quoteLabel(payload, t)
      return h('span', {
        role: 'button',
        tabIndex: 0,
        'data-inline-quote-sent': '',
        title: label,
        onClick: (event) => {
          event.stopPropagation()
          window.dispatchEvent(new CustomEvent('dsh-inline-quote:preview', { detail: { payload, deletable: false } }))
        },
        onKeyDown: (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('dsh-inline-quote:preview', { detail: { payload, deletable: false } }))
        },
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          maxWidth: '100%',
          verticalAlign: 'baseline',
          padding: '0 6px',
          margin: '0 2px',
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: 'var(--dsw-radius-sm)',
          background: 'var(--dsw-alias-interactive-bg-hover)',
          color: 'var(--dsw-alias-label-secondary)',
          fontSize: '0.92em',
          lineHeight: 1.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
        },
      }, h(QuoteGlyph), h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }, label))
    }

    function QuoteGlyph() {
      return h('svg', {
        viewBox: '0 0 24 24',
        width: 14,
        height: 14,
        'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      }, h('path', {
        d: 'M7.5 6C5.57 6 4 7.57 4 9.5V18h7v-7H7.8c.1-1.2.8-2 2.2-2V6H7.5zm9 0C14.57 6 13 7.57 13 9.5V18h7v-7h-3.2c.1-1.2.8-2 2.2-2V6h-2.5z',
        fill: 'currentColor',
      }))
    }

    function QuoteSelectionLayer({ t }) {
      const [selection, setSelection] = useState(null)
      const selectionRef = useRef(null)
      const rootRef = useRef(null)

      useEffect(() => {
        const write = (next) => {
          selectionRef.current = next
          setSelection(next)
        }
        let frame = 0
        const refresh = () => {
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => write(readSelection()))
        }
        const hide = () => write(null)
        const onPointerDown = (event) => {
          if (selectionRef.current !== null && rootRef.current !== null && !rootRef.current.contains(event.target)) hide()
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') hide()
        }
        document.addEventListener('selectionchange', refresh)
        document.addEventListener('pointerup', refresh, true)
        document.addEventListener('keyup', refresh, true)
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('scroll', hide, true)
        window.addEventListener('resize', hide)
        refresh()
        return () => {
          cancelAnimationFrame(frame)
          document.removeEventListener('selectionchange', refresh)
          document.removeEventListener('pointerup', refresh, true)
          document.removeEventListener('keyup', refresh, true)
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
          window.removeEventListener('scroll', hide, true)
          window.removeEventListener('resize', hide)
        }
      }, [])

      if (selection === null) return null
      const top = selection.rect.top > 48
        ? selection.rect.top - 38
        : selection.rect.top + selection.rect.height + 8
      const left = Math.min(Math.max(selection.rect.left + selection.rect.width / 2, 58), window.innerWidth - 58)

      return h('div', {
        ref: rootRef,
        style: { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 70 },
      }, h('button', {
        type: 'button',
        'aria-label': tr(t, 'action.quote', '引用'),
        onPointerDown: (event) => { event.preventDefault() },
        onClick: () => {
          window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert', {
            detail: {
              text: selection.text,
              kind: selection.kind,
              language: selection.language,
              lines: selection.lines,
              source: selection.source,
              sessionId: selection.sessionId,
              composerId: selection.composerId,
            },
          }))
          window.getSelection()?.removeAllRanges()
          setSelection(null)
        },
        style: {
          position: 'fixed',
          top,
          left,
          transform: 'translateX(-50%)',
          pointerEvents: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 10px',
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: 'var(--dsw-radius-md)',
          background: 'var(--dsw-specific-menu)',
          color: 'var(--dsw-alias-label-primary)',
          boxShadow: 'var(--dsw-elevation-prominent)',
          font: '500 12px/1 var(--dsh-content-font-family, system-ui, sans-serif)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        },
      }, h(QuoteGlyph), h('span', null, tr(t, 'action.quote', '引用'))))
    }

    function QuotePreviewLayer({ t }) {
      const [payload, setPayload] = useState(null)
      const [error, setError] = useState(null)
      const [copied, setCopied] = useState(false)
      const [deletable, setDeletable] = useState(false)

      const close = () => {
        setPayload(null)
        setError(null)
        setCopied(false)
        setDeletable(false)
      }

      useEffect(() => {
        const onPreview = (event) => {
          try {
            const next = event.detail?.payload ?? decodeRef(event.detail?.ref)
            if (next?.v !== 1 || typeof next.text !== 'string') throw new Error('inline-quote: invalid preview payload')
            setPayload(next)
            setError(null)
            setCopied(false)
            setDeletable(event.detail?.deletable !== false)
          } catch (cause) {
            setPayload(null)
            setError(cause instanceof Error ? cause.message : String(cause))
          }
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') close()
        }
        window.addEventListener('dsh-inline-quote:preview', onPreview)
        window.addEventListener('keydown', onKeyDown, true)
        return () => {
          window.removeEventListener('dsh-inline-quote:preview', onPreview)
          window.removeEventListener('keydown', onKeyDown, true)
        }
      }, [])

      const copy = async () => {
        if (payload === null) return
        try {
          await navigator.clipboard.writeText(payload.text)
          setCopied(true)
        } catch {
          try {
            const area = document.createElement('textarea')
            area.value = payload.text
            area.style.position = 'fixed'
            area.style.opacity = '0'
            document.body.appendChild(area)
            area.select()
            document.execCommand('copy')
            area.remove()
            setCopied(true)
          } catch {
            dispatchError(tr(t, 'error.copy', '复制失败。'))
          }
        }
      }

      if (payload === null && error === null) return null

      return h('div', {
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(0,0,0,.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          pointerEvents: 'auto',
        },
        onClick: close,
      }, h('section', {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': tr(t, 'preview.title', '引用内容'),
        'data-inline-quote-preview': '',
        onClick: (event) => event.stopPropagation(),
        style: {
          width: 'min(760px, 94vw)',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--dsw-alias-bg-layer-2)',
          backdropFilter: 'none',
          color: 'var(--dsw-alias-label-primary)',
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: 'var(--dsw-radius-panel)',
          boxShadow: 'var(--dsw-elevation-prominent)',
          overflow: 'hidden',
        },
      },
      h('header', {
        style: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--dsw-alias-border-l1)' },
      },
      h('strong', { style: { fontSize: 13, fontWeight: 600 } }, tr(t, 'preview.title', '引用内容')),
      payload?.kind === 'code'
        ? h('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
            `${payload.language ? `${payload.language} · ` : ''}${payload.lines ?? payload.text.split('\n').length} ${tr(t, 'preview.lines', '行')}`)
        : null,
      h('span', { style: { flex: 1 } }),
      h('button', {
        type: 'button',
        onClick: close,
        'aria-label': tr(t, 'preview.close', '关闭'),
        style: { border: 0, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', fontSize: 16, lineHeight: 1 },
      }, '×')),
      h('div', { style: { padding: 14, overflow: 'auto', flex: 1, minHeight: 0 } },
        error
          ? h('div', { style: { color: 'var(--dsw-alias-state-danger-primary)', fontSize: 12 } }, `${tr(t, 'error.decode', '引用内容无法读取。')} ${error}`)
          : payload.kind === 'code'
            ? h('pre', {
                style: {
                  margin: 0,
                  whiteSpace: 'pre',
                  overflow: 'auto',
                  maxHeight: '58vh',
                  padding: 10,
                  background: 'var(--dsw-alias-interactive-bg-hover)',
                  borderRadius: 'var(--dsw-radius-sm)',
                  fontFamily: 'var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
                  fontSize: 12,
                  lineHeight: 1.55,
                  tabSize: 2,
                },
              }, h('code', null, payload.text))
            : h('div', {
                style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.65, maxHeight: '58vh', overflow: 'auto' },
              }, payload.text)),
      h('footer', {
        style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--dsw-alias-border-l1)' },
      },
      h('span', { style: { flex: 1, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
        payload?.source?.turn
          ? withTurn(tr(t, 'preview.source', '来自第 {turn} 轮对话'), payload.source.turn)
          : ''),
      payload !== null ? h('button', {
        type: 'button',
        onClick: copy,
        style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 'var(--dsw-radius-sm)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
      }, copied ? tr(t, 'preview.copied', '已复制') : tr(t, 'preview.copy', '复制')) : null,
      payload !== null && deletable && typeof payload.composerId === 'string' ? h('button', {
        type: 'button',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('dsh-inline-quote:delete', {
            detail: { id: payload.id, sessionId: payload.sessionId, composerId: payload.composerId },
          }))
          close()
        },
        style: { border: '1px solid var(--dsw-alias-state-danger-primary)', borderRadius: 'var(--dsw-radius-sm)', background: 'transparent', color: 'var(--dsw-alias-state-danger-primary)', padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
      }, tr(t, 'preview.delete', '删除引用')) : null)))
    }

    function QuoteToastLayer({ t }) {
      const [message, setMessage] = useState(null)
      const timerRef = useRef(0)
      useEffect(() => {
        const onError = (event) => {
          setMessage(event.detail?.message ?? tr(t, 'error.insert', '无法插入引用。'))
          window.clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(() => setMessage(null), 4200)
        }
        window.addEventListener('dsh-inline-quote:error', onError)
        return () => {
          window.clearTimeout(timerRef.current)
          window.removeEventListener('dsh-inline-quote:error', onError)
        }
      }, [t])
      if (message === null) return null
      return h('div', {
        role: 'status',
        style: {
          position: 'fixed',
          left: '50%',
          bottom: 92,
          transform: 'translateX(-50%)',
          zIndex: 90,
          maxWidth: 'min(520px, 88vw)',
          padding: '8px 12px',
          borderRadius: 'var(--dsw-radius-md)',
          background: 'var(--dsw-specific-menu)',
          color: 'var(--dsw-alias-state-danger-primary)',
          border: '1px solid var(--dsw-alias-state-danger-primary)',
          boxShadow: 'var(--dsw-elevation-prominent)',
          fontSize: 12,
          lineHeight: 1.5,
          pointerEvents: 'none',
        },
      }, message)
    }

    function QuoteComposerBridge({ sessionId, input, inputActions, t }) {
      const inputRef = useRef(input)
      const sessionRef = useRef(sessionId)
      const actionsRef = useRef(inputActions)
      const translateRef = useRef(t)
      const bridgeIdRef = useRef(newBridgeId())
      const markerRef = useRef(null)
      inputRef.current = input
      sessionRef.current = sessionId
      actionsRef.current = inputActions
      translateRef.current = t

      useEffect(() => {
        const bridgeId = bridgeIdRef.current
        bridgeRegistry.set(bridgeId, { sessionId: sessionRef.current })
        const seat = markerRef.current?.closest('[data-composer-seat]')
        const previous = seat?.getAttribute('data-inline-quote-composer')
        seat?.setAttribute('data-inline-quote-composer', bridgeId)

        const matches = (detail) => acceptTarget(detail, bridgeId, sessionRef.current)
        const error = (key, fallback) => dispatchError(tr(translateRef.current, key, fallback))

        const insert = (detail, retry = true) => {
          if (!matches(detail)) return
          const actx = rootCtx?.sessions?.scope(sessionRef.current)
          if (!actx) return error('error.insert', '无法插入引用，请重新选择后再试。')

          const current = inputRef.current
          const caret = actionsRef.current.captureInsertion()
          const span = { start: caret.end, end: caret.end, draftRev: caret.draftRev }
          const separator = tailCharAt(current, span.end) === ' ' ? 'existing' : 'inserted'
          const payload = buildPayload({
            ...detail, sessionId: sessionRef.current, composerId: bridgeId,
          }, translateRef.current, separator)
          const reference = {
            source: 'quote',
            ref: encodeRef(payload),
            label: payload.label,
            clipboardText: tokenFor(payload.id),
          }
          if (reference.ref.length > MAX_REF_LENGTH) {
            return error('error.tooLarge', '引用过长，请缩短选区后重试。')
          }
          if (!actx.bail(actx, 'slash/input-insert-reference', { reference, span })) {
            if (retry) return window.setTimeout(() => insert(detail, false), 0)
            return error('error.insert', '无法插入引用，请重新选择后再试。')
          }

          // Keep the existing draft space cleanup only for an untouched insert.
          try {
            const revision = actionsRef.current.captureInsertion().draftRev
            if (Number.isSafeInteger(revision)) insertionRevisions.set(payload.id, revision)
          } catch {}
          // Let React apply the insertion before persisting the changed draft.
          window.setTimeout(() => {
            const stillPresent = inputRef.current.occurrences.some(
              item => item.source === 'quote' && item.ref === reference.ref,
            )
            if (stillPresent) {
              try { actionsRef.current.persistDraft() } catch {
                error('error.insert', '引用已插入，但草稿保存失败。')
              }
            }
          }, 0)
        }

        const remove = (detail) => {
          const id = detail?.id
          if (typeof id !== 'string') return
          const current = inputRef.current
          const index = current.occurrences.findIndex((item) => {
            if (item.source !== 'quote') return false
            try { return decodeRef(item.ref).id === id } catch { return false }
          })
          if (index < 0) return
          // A saved draft may contain the previous composer mount id.
          if (!matches(detail) && detail?.sessionId !== sessionRef.current) return
          const item = current.occurrences[index]
          const shift = current.occurrences.slice(0, index).reduce(
            (sum, entry) => sum + entry.clipboardText.length - 1, 0,
          )
          const start = item.offset - shift
          let end = start + 1
          try {
            const payload = decodeRef(item.ref)
            if (payload.separator === 'inserted'
              && insertionRevisions.get(id) === current.draftRev
              && current.draft[item.offset + item.length] === ' ') end += 1
          } catch {}
          if (actionsRef.current.insertText('', {
            start, end, draftRev: current.draftRev,
          })) {
            insertionRevisions.delete(id)
            try { actionsRef.current.persistDraft() } catch {}
          } else error('error.insert', '无法删除引用，请重试。')
        }

        const onInsert = (event) => insert(event.detail)
        const onDelete = (event) => remove(event.detail)
        window.addEventListener('dsh-inline-quote:insert', onInsert)
        window.addEventListener('dsh-inline-quote:delete', onDelete)
        return () => {
          window.removeEventListener('dsh-inline-quote:insert', onInsert)
          window.removeEventListener('dsh-inline-quote:delete', onDelete)
          bridgeRegistry.delete(bridgeId)
          if (seat?.getAttribute('data-inline-quote-composer') === bridgeId) {
            if (previous === null) seat.removeAttribute('data-inline-quote-composer')
            else seat.setAttribute('data-inline-quote-composer', previous)
          }
        }
      }, [])

      return h('span', {
        ref: markerRef,
        'data-inline-quote-bridge': bridgeIdRef.current,
        style: { display: 'none' },
      })
    }

    return {
      name: 'inline-quote',
      inject: ['slots', 'locale', 'sessions', 'uiConversation', 'inputTriggers'],
      apply(ctx) {
        rootCtx = ctx
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, { zh, en })
          } catch (error) {
            console.warn('[inline-quote] locale registration failed:', error)
            return () => {}
          }
        }, 'inline-quote: locale')
        ctx.effect(() => ctx.inputTriggers.registerSource(quoteSource), 'inline-quote: source')
        ctx.effect(() => ctx.uiConversation.userText.register(quoteRule), 'inline-quote: transcript rule')
        ctx.slots.inject('conversation.user.text.node', () => ctx.slots.register({
          name: 'conversation.user.text.node',
          key: 'inline-quote',
          priority: 100,
          locale: NS,
        }, InlineQuotedUserText))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'inline-quote-selection',
          order: 70,
          locale: NS,
        }, QuoteSelectionLayer))
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'inline-quote-preview',
          order: 80,
          locale: NS,
        }, QuotePreviewLayer))
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'inline-quote-toast',
          order: 90,
          locale: NS,
        }, QuoteToastLayer))
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'inline-quote-bridge',
          order: 40,
          locale: NS,
        }, QuoteComposerBridge))
      },
    }
  },
})

