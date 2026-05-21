import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'
import { analyzeTestRun } from '@/lib/watsonx'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { runId } = body as { runId?: string }

  if (!runId) {
    return Response.json({ error: 'runId is required' }, { status: 400 })
  }

  const run = await db.query.testRuns.findFirst({
    where: eq(testRuns.id, runId),
    with: { steps: true },
  })

  if (!run) {
    return Response.json({ error: 'Test run not found' }, { status: 404 })
  }

  if (run.status === 'pending' || run.status === 'running') {
    return Response.json({ error: 'Run is not yet complete' }, { status: 400 })
  }

  // return cached result if already analyzed
  if (run.analysisResult) {
    return Response.json({ analysis: run.analysisResult, cached: true })
  }

  try {
    const analysis = await analyzeTestRun({
      id: run.id,
      status: run.status,
      hardwareId: run.hardwareId,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt ?? null,
      steps: run.steps,
    })

    await db
      .update(testRuns)
      .set({ analysisResult: analysis, analyzedAt: new Date() })
      .where(eq(testRuns.id, runId))

    return Response.json({ analysis })
  } catch (err) {
    console.error('watsonx error:', err)
    return Response.json({ error: 'Analysis failed — check watsonx credentials' }, { status: 502 })
  }
}
