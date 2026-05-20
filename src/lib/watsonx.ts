import { WatsonXAI } from '@ibm-cloud/watsonx-ai'
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication'

declare global {
  // eslint-disable-next-line no-var
  var watsonxClient: WatsonXAI | undefined
}

function getClient(): WatsonXAI {
  if (global.watsonxClient) return global.watsonxClient
  const client = new WatsonXAI({
    authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY! }),
    serviceUrl: process.env.WATSONX_SERVICE_URL!,
    version: '2024-05-31',
  })
  if (process.env.NODE_ENV !== 'production') global.watsonxClient = client
  return client
}

type RunInput = {
  id: string
  status: string
  hardwareId: string | null
  startedAt: Date
  finishedAt: Date | null
  steps: { sequence: number; name: string; status: string; message: string | null }[]
}

export async function analyzeTestRun(run: RunInput): Promise<string> {
  const client = getClient()

  const stepsText =
    run.steps.length > 0
      ? run.steps
          .sort((a, b) => a.sequence - b.sequence)
          .map(
            (s) =>
              `  ${s.sequence}. [${s.status.toUpperCase()}] ${s.name}${s.message ? ` — ${s.message}` : ''}`,
          )
          .join('\n')
      : '  (no steps recorded)'

  const durationMs = run.finishedAt
    ? run.finishedAt.getTime() - run.startedAt.getTime()
    : null
  const duration = durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : 'unknown'
  const failedCount = run.steps.filter((s) => s.status === 'failed').length

  const response = await client.textChat({
    modelId: 'ibm/granite-3-8b-instruct',
    projectId: process.env.WATSONX_PROJECT_ID!,
    messages: [
      {
        role: 'system',
        content:
          'You are a hardware test engineer analyzing automated test failures. Be concise and technical. Focus strictly on the failure data provided.',
      },
      {
        role: 'user',
        content: `Analyze this hardware test run and provide a root cause analysis.

Test Run: ${run.id}
Hardware: ${run.hardwareId ?? 'unknown'}
Status: ${run.status}
Duration: ${duration}
Failed Steps: ${failedCount} of ${run.steps.length}

Steps:
${stepsText}

Respond with:
1. Root cause (1-2 sentences, specific to the failure data above)
2. Recommended next diagnostic step (1-2 sentences)`,
      },
    ],
    maxTokens: 400,
    temperature: 0.1,
  })

  return response.result.choices[0].message!.content!.trim()
}
