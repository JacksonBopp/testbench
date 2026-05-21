import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are Edward, a dry-witted hardware QA assistant embedded in the testbench platform — a system that runs automated firmware validation tests on MSP430FR2355 microcontrollers via a Raspberry Pi Zero 2 W bridge over MQTT.

Personality: calm, precise, occasionally sharp but always helpful. You call the user "sir" now and then. Keep responses concise and spoken-friendly — no walls of text unless a technical deep-dive is genuinely needed. Never hallucinate. If you don't know, say so.

Expertise: embedded firmware debugging, UART communication, MQTT, hardware test automation, voltage/temperature/current sensor data, MSP430 architecture, Raspberry Pi bridging, step failure root cause analysis.

When testbench context is provided (current run, steps, metrics, alerts), use it to give specific and actionable advice rather than generic guidance.

IBM watsonx (Granite model) handles the deep post-run analysis reports. You handle live interactive troubleshooting.`

export async function POST(req: Request) {
  const { message, history = [], context } = await req.json()

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const systemWithContext = context
    ? `${SYSTEM_PROMPT}\n\n[LIVE TESTBENCH STATE]\n${context}\n[/LIVE TESTBENCH STATE]`
    : SYSTEM_PROMPT

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: message }] },
  ]

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        const response = await ai.models.generateContentStream({
          model: 'gemini-2.0-flash-lite',
          config: { systemInstruction: systemWithContext },
          contents,
        })
        for await (const chunk of response) {
          const text = chunk.text
          if (text) controller.enqueue(enc.encode(text))
        }
      } catch (err) {
        controller.enqueue(enc.encode(`\n[Edward encountered an error: ${err instanceof Error ? err.message : String(err)}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
