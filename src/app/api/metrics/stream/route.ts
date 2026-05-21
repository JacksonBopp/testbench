import { getMqttClient } from '@/lib/mqtt'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = getMqttClient()

  const stream = new ReadableStream({
    start(controller) {
      function send(data: unknown) {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
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

      // heartbeat every 15s to keep connection alive
      const hb = setInterval(() => controller.enqueue(': ping\n\n'), 15_000)

      return () => {
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
