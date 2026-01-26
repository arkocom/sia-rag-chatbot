import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = {
    env: {
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      NODE_ENV: process.env.NODE_ENV,
      GEMINI_KEY_SET: !!process.env.GEMINI_API_KEY,
      GEMINI_KEY_LENGTH: process.env.GEMINI_API_KEY?.length ?? 0,
      DB_URL_SET: !!process.env.DATABASE_URL,
    },
    database: {
      status: 'unknown' as string,
      details: '',
      docCount: 0,
    },
    gemini: {
      status: 'unknown' as string,
      details: '',
    },
  }

  // 1. Test Database (Drizzle)
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(documents)
    status.database.status = 'ok'
    status.database.docCount = Number(result[0]?.count ?? 0)
  } catch (e: unknown) {
    status.database.status = 'error'
    status.database.details = e instanceof Error ? e.message : 'Unknown error'
  }

  // 2. Test Gemini
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY')
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent("Say 'OK'")
    const text = result.response.text()

    if (text) {
      status.gemini.status = 'ok'
      status.gemini.details = `Response: ${text.substring(0, 20)}...`
    } else {
      status.gemini.status = 'empty_response'
    }
  } catch (e: unknown) {
    status.gemini.status = 'error'
    status.gemini.details = e instanceof Error ? e.message : 'Unknown error'
  }

  return NextResponse.json(status, { status: 200 })
}
