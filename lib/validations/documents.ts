import { z } from 'zod'

export const createDocumentSchema = z.object({
  title: z.string().min(2, 'Titre requis (min 2 caractères)').max(500),
  fileType: z.enum(['pdf', 'txt', 'csv', 'json']),
  agentId: z.string().uuid().optional(),
  content: z.string().min(10, 'Contenu requis (min 10 caractères)'),
  source: z.string().min(1, 'Source requise').default('custom'),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
