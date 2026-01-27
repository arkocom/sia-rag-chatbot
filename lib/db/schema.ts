// SIA — Schéma Drizzle (PostgreSQL + pgvector)
// Ce fichier sera enrichi au fur et à mesure des phases.
// Phase 1 : structure de base uniquement.

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ============================================
// Profiles (extension de auth.users Supabase)
// ============================================
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // === auth.users.id
  email: text("email").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Types inférés pour usage TypeScript
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
