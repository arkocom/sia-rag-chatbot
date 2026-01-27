# CLAUDE.md - AI Assistant Guide for SIA RAG Chatbot

## Project Overview

**SIA** (Sources Islamiques Authentiques) is a Retrieval-Augmented Generation (RAG) chatbot that answers questions exclusively from authentic Islamic sources: the Quran, authenticated Hadiths, and classical Imam works. The chatbot transmits exact citations without interpretation. It is currently in alpha/validation phase.

- **Language**: The application UI and content are primarily in **French**
- **Domain**: Islamic religious source reference tool
- **Status**: Alpha version

## Tech Stack

| Category         | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Framework        | Next.js 14 (App Router)                        |
| Language         | TypeScript 5.2 (strict mode)                   |
| UI               | React 18, Tailwind CSS 3.3, Shadcn UI (Radix)  |
| Database         | PostgreSQL (Supabase) + Prisma 6.7 ORM         |
| Vector Search    | pgvector extension (768 dimensions)             |
| LLM              | Google Gemini 2.5-Flash (primary)               |
| Embeddings       | Google Gemini / OpenAI / Cohere (multi-provider)|
| State Management | Zustand, Jotai, React Query                    |
| Auth             | NextAuth (configured, not actively used yet)    |
| Deployment       | Vercel (primary), Google Cloud Run (alt)        |

## Project Structure

```
sia-rag-chatbot/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (French lang, Inter font, ThemeProvider)
│   ├── page.tsx                # Main chat UI (client component)
│   ├── globals.css             # Tailwind + CSS custom properties (HSL)
│   ├── docs/page.tsx           # Documentation page
│   └── api/                    # API routes
│       ├── chat/route.ts       # POST - Main RAG chat endpoint (SSE streaming)
│       ├── ingest/route.ts     # POST - Document ingestion
│       ├── health/route.ts     # GET  - Health check (DB + Gemini)
│       └── docs/route.ts       # GET  - API documentation
├── components/
│   ├── ui/                     # 30+ Shadcn/Radix UI components
│   └── theme-provider.tsx      # next-themes wrapper (light/dark)
├── lib/
│   ├── db.ts                   # Prisma client singleton
│   ├── search-service.ts       # Full-text, semantic, and hybrid search
│   ├── embedding-service.ts    # Multi-provider embedding generation
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── utils.ts                # cn() helper, formatDuration()
│   └── config/
│       └── env.ts              # Zod-validated environment variables
├── prisma/
│   ├── schema.prisma           # Database schema (DocumentChunk, Hadith, QuranVerse)
│   └── migrations/             # Prisma migrations
├── hooks/
│   └── use-toast.ts            # Toast notification hook
├── scripts/                    # Seed, import, migration, and test scripts
│   ├── seed.ts                 # Seed Quran + Hadiths (6,236 verses + 37 hadiths)
│   ├── seed-imams.ts           # Seed classical Imam works
│   ├── import-backup.ts        # Import from backup_data.json (6,372 docs)
│   ├── generate-embeddings.ts  # Generate vector embeddings
│   ├── setup-pgvector.ts       # Enable pgvector extension + indexes
│   └── test-gemini*.ts         # Gemini API connectivity tests
├── public/                     # Static assets
├── docs/                       # Architecture documentation
├── .env.example                # Required environment variables template
├── next.config.js              # Next.js config (ESLint/TS errors ignored in build)
├── tailwind.config.ts          # Tailwind theme (slate base, teal primary, amber accent)
├── components.json             # Shadcn UI configuration
├── vercel.json                 # Vercel deploy config (--legacy-peer-deps)
└── .npmrc                      # legacy-peer-deps=true
```

## Quick Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint check

# Database
npx prisma generate      # Generate Prisma client (also runs on postinstall)
npx prisma db push       # Push schema to database
npx prisma migrate dev   # Create and apply migration
npx prisma studio        # Open database GUI

# Seeding & Data
npx tsx --require dotenv/config scripts/seed.ts          # Seed Quran + Hadiths
npx tsx --require dotenv/config scripts/seed-imams.ts    # Seed Imam works
npx tsx --require dotenv/config scripts/import-backup.ts # Import full backup

# Embeddings
npx tsx --require dotenv/config scripts/generate-embeddings.ts
npx tsx --require dotenv/config scripts/setup-pgvector.ts
```

## Environment Variables

Required variables (see `.env.example` for full template):

| Variable                         | Required | Description                         |
| -------------------------------- | -------- | ----------------------------------- |
| `DATABASE_URL`                   | Yes      | PostgreSQL connection string        |
| `GEMINI_API_KEY`                 | Yes      | Google Gemini API key               |
| `NEXT_PUBLIC_SUPABASE_URL`       | Yes      | Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Yes      | Supabase public anon key            |
| `SUPABASE_SERVICE_ROLE_KEY`      | No       | Supabase service role key           |
| `ANTHROPIC_API_KEY`              | No       | Anthropic Claude API key (optional) |
| `NEXT_PUBLIC_APP_URL`            | No       | App URL (default: localhost:3000)   |
| `NODE_ENV`                       | No       | development / production            |

Environment validation is enforced via Zod in `lib/config/env.ts`.

## Architecture & Key Patterns

### RAG Pipeline (`app/api/chat/route.ts`)

1. User sends question via POST
2. Keywords extracted from the question
3. Full-text search (PostgreSQL `ts_vector`, French language) against `DocumentChunk` table
4. Top 45 candidates sent to Gemini for LLM-based relevance ranking
5. Gemini selects 5-8 most relevant chunks with source diversity
6. Final response generated via Gemini streaming (temperature 0.3, max 2000 tokens)
7. Response delivered as Server-Sent Events (SSE) to frontend
8. Response includes exact citations, sources array, and processing metadata

### Search Service (`lib/search-service.ts`)

Three search strategies:
- **Full-text**: PostgreSQL `ts_vector` with French language support, keyword normalization, ILIKE fallback
- **Semantic**: pgvector cosine distance (`<=>` operator), threshold-based filtering
- **Hybrid**: Weighted combination of full-text + semantic results

### Embedding Service (`lib/embedding-service.ts`)

Multi-provider embedding support:
- Google Gemini (`text-embedding-004`, 768 dimensions) - primary
- OpenAI (`text-embedding-3-small`)
- Cohere (`embed-multilingual-v3.0`)
- Graceful degradation when providers unavailable

### Database Schema (`prisma/schema.prisma`)

Primary model: **DocumentChunk** (maps to `document_chunks` table)
- `content` / `contentArabic` - Text in French / Arabic
- `embedding` - pgvector column (768 dimensions)
- `source` - One of: `"coran"`, `"hadith"`, `"imam"`
- `reference` - Precise citation (e.g., "Sourate 2, Verset 255")
- `grade` - Hadith authentication grade: `sahih`, `hasan`, `daif`
- `themes` - String array of thematic tags
- `isnad` - Hadith chain of narration

Future models: **Hadith**, **QuranVerse** (defined in schema, not actively used yet)

### Data Corpus

~6,372 documents total:
- **Quran**: 6,236 verses (Arabic + French translation)
- **Hadiths**: 37 authenticated excerpts
- **Imam works**: Riyad as-Salihin (An-Nawawi), Al-Adab al-Mufrad (Al-Bukhari), Ihya' Ulum al-Din (Al-Ghazali), La Risala (Al-Qayrawani)

## Coding Conventions

### TypeScript

- Strict mode enabled in `tsconfig.json`
- Path alias: `@/*` maps to project root (e.g., `@/lib/db`, `@/components/ui/button`)
- Shared types in `lib/types.ts` - use `ChatResponse`, `SourceReference`, `StreamEvent`, etc.
- Zod for runtime validation (preferred over Yup for new code)

### Styling

- Tailwind CSS with HSL CSS custom properties defined in `globals.css`
- Dark mode via class strategy (`dark:` prefix), managed by `next-themes`
- Use `cn()` from `lib/utils.ts` for conditional class merging (clsx + tailwind-merge)
- Color palette: teal primary, amber/emerald accent, slate neutral base
- All new UI components should use Shadcn UI patterns from `components/ui/`

### Components

- Shadcn UI components live in `components/ui/` - do not modify these directly; customize via props and className
- Custom components go in `components/` root
- Use `"use client"` directive for interactive components
- Server components by default (Next.js App Router convention)

### API Routes

- All API routes use Next.js App Router format (`app/api/*/route.ts`)
- Export named functions: `GET`, `POST`, etc.
- Return `NextResponse.json()` for standard responses
- Chat endpoint uses `ReadableStream` for SSE streaming
- API version tracked in `lib/types.ts` as `API_VERSION`

### Database

- Use the Prisma singleton from `lib/db.ts` (import as `prisma`)
- Never instantiate `new PrismaClient()` directly
- Database table names use snake_case (via `@@map`)
- Model field names use camelCase in code, snake_case in DB (via `@map`)

### State Management

- Zustand for global client state
- React Query for server state / data fetching
- Jotai for atomic state when needed
- Keep server-side logic in API routes, not client components

## Important Constraints

### Content Policy (Critical)

The system prompt in `app/api/chat/route.ts` enforces strict rules:
- **NO interpretation** - The chatbot must never interpret, explain meaning, or give opinions
- **Transmission only** - Only transmit exact text from authentic sources
- **Forbidden words**: "signifie" (means), "enseigne" (teaches), "symbolise" (symbolizes), etc.
- **Mandatory citations** - Every response must include precise source references
- **Arabic handling** - Provide literal French translation alongside Arabic text

Any changes to the chat route or system prompt must preserve these constraints.

### Build Configuration

- ESLint errors are **ignored** during build (`next.config.js`: `ignoreDuringBuilds: true`)
- TypeScript errors are **ignored** during build (`ignoreBuildErrors: true`)
- Images are unoptimized (static export compatible)
- Install requires `--legacy-peer-deps` flag (configured in `.npmrc` and `vercel.json`)

### Dependencies

- Use `npm install --legacy-peer-deps` when adding packages (peer dependency conflicts exist)
- The `postinstall` script runs `prisma generate` automatically

## API Endpoints

| Endpoint      | Method | Description                              |
| ------------- | ------ | ---------------------------------------- |
| `/api/chat`   | POST   | RAG chat query, returns SSE stream       |
| `/api/ingest` | POST   | Ingest new documents into DB             |
| `/api/health` | GET    | Health check (DB + Gemini connectivity)  |
| `/api/docs`   | GET    | API documentation                        |

### Chat Request/Response

```typescript
// Request
POST /api/chat
{ "message": "Que disent les sources sur la patience ?" }

// SSE Response
{
  "status": "completed",
  "result": {
    "response_text": "...",
    "sources": [
      {
        "id": "clx...",
        "score": 0.95,
        "snippet": "...",
        "reference": "Sourate Al-Baqara, verset 153",
        "source_type": "coran"
      }
    ],
    "metadata": {
      "processing_time_ms": 2340,
      "sources_searched": 6372,
      "sources_selected": 5,
      "model": "gemini-2.5-flash",
      "api_version": "1.0.0"
    }
  }
}
```

## Testing

No automated test suite is configured. Quality assurance currently relies on:
- TypeScript strict mode
- ESLint (via `npm run lint`)
- Manual integration test scripts in `scripts/` (e.g., `test-gemini.ts`, `verify-db.ts`)
- Health check endpoint (`/api/health`)

## Deployment

**Primary**: Vercel (auto-deploy from Git)
- Set environment variables in Vercel dashboard
- `vercel.json` configures `--legacy-peer-deps` install

**Database**: Supabase (managed PostgreSQL)
- Enable pgvector extension via `scripts/setup-pgvector.ts`
- Use session pooler connection string for `DATABASE_URL`

See `DEPLOYMENT.md` and `ANTIGRAVITY_SETUP.md` for detailed deployment guides.
