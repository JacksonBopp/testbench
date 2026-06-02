import { getMqttClient } from '@/lib/mqtt'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = getMqttClient()

  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      function send(data: unknown) {
        if (closed) return
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
        } catch {
          closed = true
        }
      }

      function onMessage(topic: string, payload: Buffer) {
        try {
          const msg = JSON.parse(payload.toString())
          send({ topic, ...msg })
        } catch {
          // ignore malformed messages
        }
      }

      client.subscribe('testbench/#')
      client.on('message', onMessage)

      const hb = setInterval(() => {
        if (closed) { clearInterval(hb); return }
        try {
          controller.enqueue(': ping\n\n')
        } catch {
          closed = true
          clearInterval(hb)
        }
      }, 15_000)

      return () => {
        closed = true
        clearInterval(hb)
        client.removeListener('message', onMessage)
        client.unsubscribe('testbench/#')
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
