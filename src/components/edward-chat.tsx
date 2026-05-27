'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'model'
  text: string
}

export default function EdwardChat() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { role: 'user', text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)

    // convert history to Gemini content format (exclude the new user message — sent separately)
    const history = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }))

    // inject basic page context
    const context = [
      `Current URL: ${window.location.pathname}`,
      `Time: ${new Date().toLocaleString()}`,
    ].join('\n')

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history, context }),
    })

    if (!res.ok || !res.body) {
      setMessages((prev) => [...prev, { role: 'model', text: 'Something went wrong, sir.' }])
      setStreaming(false)
      return
    }

    // stream in the response
    const edwardMsg: Message = { role: 'model', text: '' }
    setMessages((prev) => [...prev, edwardMsg])

    const reader = res.body.getReader()
    const dec    = new TextDecoder()
    let done = false

    while (!done) {
      const { value, done: d } = await reader.read()
      done = d
      if (value) {
        const chunk = dec.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'model',
            text: updated[updated.length - 1].text + chunk,
          }
          return updated
        })
      }
    }

    setStreaming(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* floating trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a1a00 100%)', border: '1.5px solid #DAA520' }}
        title="Ask Edward"
      >
        <span style={{ color: '#DAA520', fontFamily: 'serif', fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>
          E
        </span>
      </button>

      {/* panel */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col rounded-xl overflow-hidden shadow-2xl"
          style={{
            width: '360px',
            height: '520px',
            background: '#0D0D0D',
            border: '1px solid #2a2a2a',
          }}
        >
          {/* header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: '#141414', borderBottom: '1px solid #2a2a2a' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #1a1a1a, #2a1a00)', border: '1px solid #DAA520' }}
              >
                <span style={{ color: '#DAA520', fontFamily: 'serif', fontSize: '13px', fontWeight: 'bold' }}>E</span>
              </div>
              <div>
                <p style={{ color: '#DAA520', fontSize: '13px', fontWeight: '600', letterSpacing: '0.05em' }}>EDWARD</p>
                <p style={{ color: '#555', fontSize: '10px', letterSpacing: '0.08em' }}>HARDWARE QA ASSISTANT</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#DAA520')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
            >
              <X size={15} />
            </button>
          </div>

          {/* messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a2a transparent' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: '#333' }}>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ border: '1px solid #2a2a2a' }}
                >
                  <span style={{ color: '#DAA520', fontFamily: 'serif', fontSize: '22px', fontWeight: 'bold', opacity: 0.4 }}>E</span>
                </div>
                <p style={{ color: '#444', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>
                  Ready when you are, sir.<br />Ask me about your hardware.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5"
                    style={{ border: '1px solid #DAA520', background: '#141414' }}
                  >
                    <span style={{ color: '#DAA520', fontFamily: 'serif', fontSize: '10px', fontWeight: 'bold' }}>E</span>
                  </div>
                )}
                <div
                  className="max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? { background: '#1a1a1a', color: '#d4d4d4', border: '1px solid #2a2a2a' }
                      : { background: '#0A1628', color: '#c8d8e8', border: '1px solid #1a2a3a' }
                  }
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.role === 'model' && streaming && i === messages.length - 1 && msg.text === '' && (
                    <span style={{ color: '#DAA520' }} className="animate-pulse">▋</span>
                  )}
                  {msg.role === 'model' && streaming && i === messages.length - 1 && msg.text !== '' && (
                    <span style={{ color: '#DAA520' }} className="animate-pulse">▋</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
            <div
              className="flex items-end gap-2 rounded-lg px-3 py-2"
              style={{ background: '#141414', border: '1px solid #2a2a2a' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your hardware…"
                rows={1}
                disabled={streaming}
                className="flex-1 resize-none bg-transparent text-xs outline-none"
                style={{
                  color: '#d4d4d4',
                  caretColor: '#DAA520',
                  maxHeight: '80px',
                  overflowY: 'auto',
                }}
              />
              <button
                onClick={send}
                disabled={streaming || !input.trim()}
                className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                style={{
                  background: input.trim() && !streaming ? '#DAA520' : '#1a1a1a',
                  color: input.trim() && !streaming ? '#0D0D0D' : '#333',
                }}
              >
                {streaming
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Send size={13} />
                }
              </button>
            </div>
            <p className="mt-1.5 text-center" style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.05em' }}>
              POWERED BY IBM WATSONX · GRANITE 3.8B
            </p>
          </div>
        </div>
      )}
    </>
  )
}
