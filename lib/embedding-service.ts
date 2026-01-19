/**
 * Service d'embeddings pour la recherche sémantique
 * Support multi-provider: OpenAI, HuggingFace, Cohere, Google Gemini ou local
 * 
 * Configuration via EMBEDDING_PROVIDER et clés API associées
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const EMBEDDING_DIMENSIONS = 768; // Gemini Text-Embedding-004 dimensions
const EMBEDDING_MODEL = 'text-embedding-004';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export interface EmbeddingProvider {
  name: string;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddingsBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Provider OpenAI (payant mais très précis)
 */
async function openaiEmbedding(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY non configurée');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts.map(t => t.slice(0, 8000))
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

/**
 * Provider Cohere (gratuit jusqu'à 100 requêtes/min)
 */
async function cohereEmbedding(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error('COHERE_API_KEY non configurée');

  const response = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      texts: texts.map(t => t.slice(0, 4000)),
      model: 'embed-multilingual-v3.0',
      input_type: 'search_document'
    })
  });

  if (!response.ok) throw new Error(`Cohere API error: ${response.status}`);
  const data = await response.json();
  return data.embeddings;
}

/**
 * Provider Google Gemini (Gratuit)
 */
async function geminiEmbedding(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurée');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const results: number[][] = [];

  // Gemini batch embedding requests (not strictly batched by SDK, doing sequential for simplicity now, or promise.all)
  // Note: The SDK supports batchEmbedContents but let's keep it simple for now or implement batch correctly.

  // Implémentation séquentielle/parallèle simple
  const promises = texts.map(async (text) => {
    try {
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (e) {
      console.error("Gemini embedding error:", e);
      return [];
    }
  });

  return Promise.all(promises);
}

/**
 * Génère un embedding pour un texte donné
 * Utilise le provider configuré dans EMBEDDING_PROVIDER
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || 'none';
  const cleanText = text.replace(/\s+/g, ' ').trim();

  try {
    switch (provider.toLowerCase()) {
      case 'openai':
        const [openaiResult] = await openaiEmbedding([cleanText]);
        return openaiResult;
      case 'cohere':
        const [cohereResult] = await cohereEmbedding([cleanText]);
        return cohereResult;
      case 'gemini':
        const [geminiResult] = await geminiEmbedding([cleanText]);
        return geminiResult;
      default:
        // Pas de provider configuré - retourner un tableau vide
        console.warn('Aucun provider d\'embedding configuré (EMBEDDING_PROVIDER)');
        return [];
    }
  } catch (error: any) {
    console.error('Erreur génération embedding:', error.message);
    return [];
  }
}

/**
 * Génère des embeddings en batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
  const provider = process.env.EMBEDDING_PROVIDER || 'none';
  const cleanedTexts = texts.map(t => t.replace(/\s+/g, ' ').trim());
  const results: EmbeddingResult[] = [];

  if (provider === 'none') {
    console.warn('Aucun provider d\'embedding configuré');
    return texts.map(text => ({ text, embedding: [] }));
  }

  const BATCH_SIZE = provider === 'cohere' ? 96 : (provider === 'gemini' ? 10 : 50);

  for (let i = 0; i < cleanedTexts.length; i += BATCH_SIZE) {
    const batch = cleanedTexts.slice(i, i + BATCH_SIZE);

    try {
      let embeddings: number[][];

      switch (provider.toLowerCase()) {
        case 'openai':
          embeddings = await openaiEmbedding(batch);
          break;
        case 'cohere':
          embeddings = await cohereEmbedding(batch);
          break;
        case 'gemini':
          embeddings = await geminiEmbedding(batch);
          break;
        default:
          embeddings = batch.map(() => []);
      }

      for (let j = 0; j < batch.length; j++) {
        results.push({
          text: texts[i + j],
          embedding: embeddings[j] || []
        });
      }

      console.log(`Embeddings générés: ${results.length}/${texts.length}`);

      // Pause pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error: any) {
      console.error(`Erreur batch ${i}:`, error.message);
      // Ajouter des résultats vides pour ce batch
      for (let j = 0; j < batch.length; j++) {
        results.push({ text: texts[i + j], embedding: [] });
      }
    }
  }

  return results;
}

/**
 * Calcule la similarité cosinus entre deux vecteurs
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Vérifie si les embeddings sont disponibles
 */
export function isEmbeddingEnabled(): boolean {
  const provider = process.env.EMBEDDING_PROVIDER || 'none';
  return provider !== 'none' && provider !== '';
}

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };
