import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
    const status = {
        env: {
            NEXT_RUNTIME: process.env.NEXT_RUNTIME,
            NODE_ENV: process.env.NODE_ENV,
            GEMINI_KEY_SET: !!process.env.GEMINI_API_KEY,
            GEMINI_KEY_LENGTH: process.env.GEMINI_API_KEY?.length || 0,
            DB_URL_SET: !!process.env.DATABASE_URL,
            AUTH_SET: !!process.env.ADMIN_PASSWORD,
        },
        database: {
            status: 'unknown',
            details: '',
            docCount: 0
        },
        gemini: {
            status: 'unknown',
            details: ''
        }
    }

    // 1. Test Database
    try {
        const count = await prisma.documentChunk.count()
        status.database.status = 'ok'
        status.database.docCount = count
    } catch (e: any) {
        status.database.status = 'error'
        status.database.details = e.message
    }

    // 2. Test Gemini
    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("Missing GEMINI_API_KEY")
        }
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Quick generation test
        const result = await model.generateContent("Say 'OK'");
        const text = result.response.text();

        if (text) {
            status.gemini.status = 'ok'
            status.gemini.details = `Response: ${text.substring(0, 20)}...`
        } else {
            status.gemini.status = 'empty_response'
        }
    } catch (e: any) {
        status.gemini.status = 'error'
        status.gemini.details = e.message
    }

    return NextResponse.json(status, { status: 200 })
}
