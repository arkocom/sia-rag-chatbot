/**
 * Découpe un texte en chunks de taille contrôlée avec overlap.
 * Chaque chunk garde suffisamment de contexte grâce au chevauchement.
 */

interface ChunkOptions {
  maxTokens?: number     // ~taille max par chunk (en mots approximés)
  overlap?: number       // nombre de mots de chevauchement
  source: string         // type de source (coran, hadith, imam, custom)
  reference: string      // référence du document parent
}

export interface TextChunk {
  content: string
  chunkIndex: number
  tokenCount: number
  source: string
  reference: string
}

/**
 * Découpe un texte en chunks intelligents.
 * Coupe de préférence aux fins de paragraphes/phrases.
 */
export function chunkText(
  text: string,
  options: ChunkOptions
): TextChunk[] {
  const { maxTokens = 500, overlap = 50, source, reference } = options

  // Nettoyer le texte
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []

  // Découper en paragraphes
  const paragraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0)

  const chunks: TextChunk[] = []
  let currentChunk = ''
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/)
    const currentWords = currentChunk.split(/\s+/).filter(Boolean)

    // Si ajouter ce paragraphe dépasse la limite, finaliser le chunk
    if (currentWords.length + words.length > maxTokens && currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        tokenCount: currentWords.length,
        source,
        reference: `${reference} [chunk ${chunkIndex + 1}]`,
      })
      chunkIndex++

      // Overlap : garder les derniers mots
      const overlapText = currentWords.slice(-overlap).join(' ')
      currentChunk = overlapText + '\n\n' + paragraph.trim()
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph.trim()
    }
  }

  // Dernier chunk
  if (currentChunk.trim()) {
    const words = currentChunk.trim().split(/\s+/).filter(Boolean)
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex,
      tokenCount: words.length,
      source,
      reference: `${reference} [chunk ${chunkIndex + 1}]`,
    })
  }

  return chunks
}
