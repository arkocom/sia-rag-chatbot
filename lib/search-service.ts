/**
 * Service de recherche hybride : full-text + pgvector.
 * Utilise Drizzle ORM avec PostgreSQL.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export interface SearchResult {
  id: string
  content: string
  reference: string
  source: string
  metadata: Record<string, unknown> | null
  score: number
}

/**
 * Recherche full-text PostgreSQL (ts_vector).
 */
export async function searchFullText(
  query: string,
  options: {
    limit?: number
    sources?: string[]
    excludeIds?: string[]
  } = {}
): Promise<SearchResult[]> {
  const { limit = 15, sources, excludeIds = [] } = options

  const searchTerms = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 2)
    .slice(0, 10)
    .join(' | ')

  if (!searchTerms) return []

  try {
    const results = await db.execute(sql`
      SELECT
        id,
        content,
        reference,
        source,
        metadata,
        ts_rank_cd(
          to_tsvector('french', coalesce(content, '') || ' ' || coalesce(reference, '')),
          to_tsquery('french', ${searchTerms})
        ) as score
      FROM documents
      WHERE to_tsvector('french', coalesce(content, '') || ' ' || coalesce(reference, ''))
            @@ to_tsquery('french', ${searchTerms})
        ${sources && sources.length > 0 ? sql`AND source = ANY(${sources})` : sql``}
        ${excludeIds.length > 0 ? sql`AND id != ALL(${excludeIds})` : sql``}
      ORDER BY score DESC
      LIMIT ${limit}
    `)

    return results as unknown as SearchResult[]
  } catch (error) {
    console.error('Erreur recherche full-text:', error)
    return fallbackSearch(query, { limit, sources })
  }
}

/**
 * Recherche sémantique avec pgvector (distance cosinus).
 */
export async function searchVector(
  queryEmbedding: number[],
  options: {
    limit?: number
    threshold?: number
    sources?: string[]
  } = {}
): Promise<SearchResult[]> {
  const { limit = 10, threshold = 0.5, sources } = options
  const embeddingStr = `[${queryEmbedding.join(',')}]`

  try {
    const results = await db.execute(sql`
      SELECT
        id,
        content,
        reference,
        source,
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) as score
      FROM documents
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
        ${sources && sources.length > 0 ? sql`AND source = ANY(${sources})` : sql``}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `)

    return results as unknown as SearchResult[]
  } catch (error) {
    console.error('Erreur recherche vectorielle:', error)
    return []
  }
}

/**
 * Recherche hybride : combine full-text + vectorielle.
 */
export async function searchHybrid(
  query: string,
  queryEmbedding?: number[],
  options: {
    limit?: number
    textWeight?: number
  } = {}
): Promise<SearchResult[]> {
  const { limit = 10, textWeight = 0.5 } = options

  const textResults = await searchFullText(query, { limit: limit * 2 })

  if (!queryEmbedding || queryEmbedding.length === 0) {
    return textResults.slice(0, limit)
  }

  const semanticResults = await searchVector(queryEmbedding, { limit: limit * 2 })

  const combined = new Map<string, SearchResult & { textScore: number; semanticScore: number }>()

  for (const result of textResults) {
    combined.set(result.id, { ...result, textScore: result.score, semanticScore: 0 })
  }

  for (const result of semanticResults) {
    const existing = combined.get(result.id)
    if (existing) {
      existing.semanticScore = result.score
    } else {
      combined.set(result.id, { ...result, textScore: 0, semanticScore: result.score })
    }
  }

  return Array.from(combined.values())
    .map(r => ({ ...r, score: r.textScore * textWeight + r.semanticScore * (1 - textWeight) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Recherche ILIKE de secours.
 */
async function fallbackSearch(
  query: string,
  options: { limit?: number; sources?: string[] } = {}
): Promise<SearchResult[]> {
  const { limit = 15, sources } = options

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 5)

  if (keywords.length === 0) return []

  const likePattern = `%${keywords.join('%')}%`

  const results = await db.execute(sql`
    SELECT id, content, reference, source, metadata, 0.5 as score
    FROM documents
    WHERE content ILIKE ${likePattern}
      ${sources && sources.length > 0 ? sql`AND source = ANY(${sources})` : sql``}
    LIMIT ${limit}
  `)

  return results as unknown as SearchResult[]
}
