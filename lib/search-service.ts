/**
 * Service de recherche avancée avec PostgreSQL Full-Text Search
 * Utilise ts_vector pour la recherche textuelle
 * Prêt pour l'intégration future des embeddings pgvector
 */

import { prisma } from './db';

export interface SearchResult {
  id: string;
  content: string;
  reference: string;
  source: string;
  grade?: string | null;
  themes: string[];
  metadata: any;
  score: number;
}

/**
 * Recherche full-text avec PostgreSQL
 * Utilise la configuration française pour la recherche
 */
export async function searchDocuments(
  query: string,
  options: {
    limit?: number;
    sources?: string[];
    excludeIds?: string[];
  } = {}
): Promise<SearchResult[]> {
  const { limit = 15, sources, excludeIds = [] } = options;
  
  // Préparer la requête pour ts_query
  const searchTerms = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
    .replace(/[^\w\s]/g, ' ')        // Supprimer ponctuation
    .split(/\s+/)
    .filter(term => term.length > 2)
    .slice(0, 10)                     // Max 10 termes
    .join(' | ');                     // OR entre les termes
  
  if (!searchTerms) {
    return [];
  }

  try {
    // Recherche full-text avec ranking
    const results: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        content,
        reference,
        source,
        grade,
        themes,
        metadata,
        ts_rank_cd(
          to_tsvector('french', coalesce(content, '') || ' ' || coalesce(reference, '')),
          to_tsquery('french', $1)
        ) as score
      FROM document_chunks
      WHERE to_tsvector('french', coalesce(content, '') || ' ' || coalesce(reference, ''))
            @@ to_tsquery('french', $1)
        ${sources && sources.length > 0 ? `AND source = ANY($2::text[])` : ''}
        ${excludeIds.length > 0 ? `AND id != ALL($${sources ? '3' : '2'}::text[])` : ''}
      ORDER BY score DESC
      LIMIT $${sources ? (excludeIds.length > 0 ? '4' : '3') : (excludeIds.length > 0 ? '3' : '2')}
    `,
      searchTerms,
      ...(sources && sources.length > 0 ? [sources] : []),
      ...(excludeIds.length > 0 ? [excludeIds] : []),
      limit
    );
    
    return results.map(r => ({
      id: r.id,
      content: r.content,
      reference: r.reference,
      source: r.source,
      grade: r.grade,
      themes: r.themes || [],
      metadata: r.metadata,
      score: parseFloat(r.score) || 0
    }));
    
  } catch (error: any) {
    console.error('Erreur recherche full-text:', error.message);
    // Fallback: recherche ILIKE simple
    return fallbackSearch(query, { limit, sources, excludeIds });
  }
}

/**
 * Recherche de secours avec ILIKE
 */
async function fallbackSearch(
  query: string,
  options: {
    limit?: number;
    sources?: string[];
    excludeIds?: string[];
  } = {}
): Promise<SearchResult[]> {
  const { limit = 15, sources, excludeIds = [] } = options;
  
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 5);
  
  if (keywords.length === 0) return [];
  
  // Construire la condition WHERE
  const likeConditions = keywords.map(k => `content ILIKE '%${k}%'`).join(' OR ');
  
  const results: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, content, reference, source, grade, themes, metadata, 0.5 as score
    FROM document_chunks
    WHERE (${likeConditions})
      ${sources && sources.length > 0 ? `AND source = ANY($1::text[])` : ''}
      ${excludeIds.length > 0 ? `AND id != ALL($${sources ? '2' : '1'}::text[])` : ''}
    LIMIT $${sources ? (excludeIds.length > 0 ? '3' : '2') : (excludeIds.length > 0 ? '2' : '1')}
  `,
    ...(sources && sources.length > 0 ? [sources] : []),
    ...(excludeIds.length > 0 ? [excludeIds] : []),
    limit
  );
  
  return results.map(r => ({
    id: r.id,
    content: r.content,
    reference: r.reference,
    source: r.source,
    grade: r.grade,
    themes: r.themes || [],
    metadata: r.metadata,
    score: 0.5
  }));
}

/**
 * Recherche sémantique avec pgvector (quand les embeddings seront générés)
 */
export async function searchSemantic(
  queryEmbedding: number[],
  options: {
    limit?: number;
    threshold?: number;
    sources?: string[];
  } = {}
): Promise<SearchResult[]> {
  const { limit = 10, threshold = 0.5, sources } = options;
  
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  try {
    const results: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        content,
        reference,
        source,
        grade,
        themes,
        metadata,
        1 - (embedding <=> $1::vector) as score
      FROM document_chunks
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) > $2
        ${sources && sources.length > 0 ? `AND source = ANY($3::text[])` : ''}
      ORDER BY embedding <=> $1::vector
      LIMIT $${sources && sources.length > 0 ? '4' : '3'}
    `,
      embeddingStr,
      threshold,
      ...(sources && sources.length > 0 ? [sources] : []),
      limit
    );
    
    return results.map(r => ({
      id: r.id,
      content: r.content,
      reference: r.reference,
      source: r.source,
      grade: r.grade,
      themes: r.themes || [],
      metadata: r.metadata,
      score: parseFloat(r.score) || 0
    }));
    
  } catch (error) {
    console.error('Erreur recherche sémantique:', error);
    return [];
  }
}

/**
 * Recherche hybride: combine full-text et sémantique
 */
export async function searchHybrid(
  query: string,
  queryEmbedding?: number[],
  options: {
    limit?: number;
    textWeight?: number; // Poids de la recherche textuelle (0-1)
  } = {}
): Promise<SearchResult[]> {
  const { limit = 10, textWeight = 0.5 } = options;
  
  // Recherche textuelle
  const textResults = await searchDocuments(query, { limit: limit * 2 });
  
  // Si pas d'embedding, retourner uniquement les résultats textuels
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return textResults.slice(0, limit);
  }
  
  // Recherche sémantique
  const semanticResults = await searchSemantic(queryEmbedding, { limit: limit * 2 });
  
  // Fusionner et normaliser les scores
  const combined = new Map<string, SearchResult & { textScore: number; semanticScore: number }>();
  
  for (const result of textResults) {
    combined.set(result.id, {
      ...result,
      textScore: result.score,
      semanticScore: 0
    });
  }
  
  for (const result of semanticResults) {
    const existing = combined.get(result.id);
    if (existing) {
      existing.semanticScore = result.score;
    } else {
      combined.set(result.id, {
        ...result,
        textScore: 0,
        semanticScore: result.score
      });
    }
  }
  
  // Calculer le score final pondéré
  const finalResults = Array.from(combined.values()).map(r => ({
    ...r,
    score: (r.textScore * textWeight) + (r.semanticScore * (1 - textWeight))
  }));
  
  // Trier par score final et retourner
  return finalResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
