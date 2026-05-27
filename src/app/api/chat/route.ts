import { WatsonXAI } from '@ibm-cloud/watsonx-ai'
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are Edward, a dry-witted hardware QA assistant embedded in the testbench platform — a system that runs automated firmware validation tests on MSP430FR2355 microcontrollers via a Raspberry Pi Zero 2 W bridge over MQTT.

Personality: calm, precise, occasionally sharp but always helpful. Call the user "sir" now and then. Keep responses concise — no walls of text unless a technical deep-dive is genuinely needed. Never hallucinate. If you don't know, say so.

Expertise: embedded firmware debugging, UART communication, MQTT, hardware test automation, voltage/temperature/current sensor data, MSP430 architecture, Raspberry Pi bridging, step failure root cause analysis.

When testbench context is provided, use it to give specific and actionable advice.`

function getClient() {
  return new WatsonXAI({
    authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY! }),
    serviceUrl: process.env.WATSONX_SERVICE_URL!,
    version: '2024-05-31',
  })
}

export async function POST(req: Request) {
  const { message, history = [], context } = await req.json()

  const systemContent = context
    ? `${SYSTEM_PROMPT}\n\n[LIVE TESTBENCH STATE]\n${context}\n[/LIVE TESTBENCH STATE]`
    : SYSTEM_PROMPT

  const messages = [
    { role: 'system' as const, content: systemContent },
    ...history.map((m: { role: string; text: string }) => ({
      role: m.role === 'model' ? 'assistant' as const : 'user' as const,
      content: m.text,
    })),
    { role: 'user' as const, content: message },
  ]

  try {
    const client = getClient()
    const response = await client.textChat({
      modelId: 'ibm/granite-3-8b-instruct',
      projectId: process.env.WATSONX_PROJECT_ID!,
      messages,
      maxTokens: 400,
      temperature: 0.7,
    })

    const text = response.result.choices[0].message?.content?.trim() ?? 'No response, sir.'

    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(`[Edward encountered an error: ${msg}]`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
