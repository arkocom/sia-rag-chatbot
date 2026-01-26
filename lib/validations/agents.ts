import { z } from 'zod'

export const createAgentSchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)').max(200),
  description: z.string().max(2000).optional(),
  tone: z.enum(['neutre', 'pedagogique', 'academique']).default('neutre'),
  systemPrompt: z.string().max(10000).optional(),
  temperature: z.number().min(0).max(2).default(0.1),
  maxSources: z.number().int().min(1).max(50).default(20),
})

export const updateAgentSchema = createAgentSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreateAgentInput = z.infer<typeof createAgentSchema>
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
