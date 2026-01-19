# SIA - Sources Islamiques Authentiques

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.7-2D3748)](https://www.prisma.io/)

## 📖 Description

SIA est un chatbot RAG (Retrieval-Augmented Generation) conçu pour répondre à des questions religieuses en s'appuyant **exclusivement** sur des textes authentiques. L'objectif est de fournir des réponses sans aucune interprétation personnelle ou théologique.

### 📚 Sources Indexées (6 372 documents)

- **Coran** : 6 236 versets (arabe et français)
- **Hadiths** : 37 extraits du Prophète ﷺ
- **Ouvrages des Imams** :
  - *Riyad as-Salihin* (An-Nawawi)
  - *Al-Adab al-Mufrad* (Al-Bukhari)
  - *Ihya' Ulum al-Din* (Al-Ghazali)
  - *La Risala* (Al-Qayrawani)

## ✨ Fonctionnalités

- ✅ **RAG Pipeline** : Recherche par mots-clés + sélection LLM
- ✅ **Sessions Multi-Tour** : Contexte maintenu sur 5+ échanges
- ✅ **Classification d'Intentions** : Détection automatique du type de question
- ✅ **Score de Confiance** : Indicateur de fiabilité de la réponse
- ✅ **Format JSON Structuré** : API standardisée pour intégration
- ✅ **Escalade Humaine** : Suggestion de contact spécialiste si confiance faible

## 🚀 Installation

### Prérequis

- Node.js 18+
- PostgreSQL 15+
- Yarn

### Étapes

```bash
# Cloner le dépôt
git clone https://github.com/arkocom/sia-rag-chatbot.git
cd sia-rag-chatbot

# Installer les dépendances
yarn install

# Configurer l'environnement
cp .env.example .env
# Modifier DATABASE_URL et ABACUSAI_API_KEY dans .env

# Initialiser la base de données
yarn prisma db push
yarn prisma generate

# Peupler la base avec les sources
yarn tsx scripts/seed.ts
yarn tsx scripts/seed-imams.ts

# Lancer le serveur de développement
yarn dev
```

## 📡 API Endpoints

### POST /api/chat - Chat principal

**Request:**
```json
{
  "message": "Que disent les sources sur la patience ?",
  "session_id": "sess_123..." // Optionnel
}
```

**Response:**
```json
{
  "response_text": "...",
  "sources": [
    {
      "id": "clx123...",
      "score": 0.95,
      "snippet": "...",
      "reference": "Sourate Al-Baqara, verset 153",
      "source_type": "coran"
    }
  ],
  "intent": "question_religious",
  "confidence": 0.85,
  "session_id": "sess_123...",
  "actions": [{ "type": "cite_source" }],
  "metadata": {
    "processing_time_ms": 2340,
    "sources_searched": 6372,
    "sources_selected": 5,
    "model": "gpt-4.1-mini",
    "api_version": "1.0.0"
  }
}
```

### GET /api/session - Gestion des sessions

```bash
# Lister les sessions actives
GET /api/session

# Détails d'une session
GET /api/session?id=xxx

# Nettoyer les sessions expirées
GET /api/session?action=cleanup
```

### POST /api/ingest - Ingestion de documents

```json
{
  "documents": [
    {
      "content": "Texte du document...",
      "source": "coran|hadith|imam",
      "reference": "Sourate 2, Verset 255",
      "metadata": {}
    }
  ]
}
```

### GET /api/admin - Dashboard administrateur

```bash
# Dashboard général
GET /api/admin

# Statistiques détaillées
GET /api/admin?action=stats

# Liste des sources
GET /api/admin?action=sources
```

### POST /api/escalate - Escalade humaine

```json
{
  "session_id": "sess_xxx",
  "user_name": "Jean Dupont",
  "user_email": "jean@exemple.com",
  "reason": "Question complexe nécessitant un avis qualifié",
  "urgency": "low|medium|high",
  "preferred_contact": "email|phone"
}
```

### POST /api/auth/token - Gestion des tokens API

```bash
# Créer un token (nécessite x-admin-secret)
curl -X POST https://sia2026.abacusai.app/api/auth/token \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name": "Mon App", "permissions": ["read", "write"], "expires_in_days": 30}'

# Lister les tokens
curl -X GET https://sia2026.abacusai.app/api/auth/token \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"

# Révoquer un token
curl -X DELETE "https://sia2026.abacusai.app/api/auth/token?id=xxx" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

### GET/POST /api/gdpr - Conformité RGPD

```bash
# Enregistrer le consentement
POST /api/gdpr
{
  "session_id": "sess_xxx",
  "consent_given": true,
  "purposes": ["analytics", "personalization"]
}

# Vérifier le consentement
GET /api/gdpr?session_id=sess_xxx

# Exporter les données (Art. 20)
POST /api/gdpr/export
{
  "session_id": "sess_xxx",
  "request_type": "export"
}

# Demander la suppression (Art. 17 - Droit à l'oubli)
POST /api/gdpr/export
{
  "session_id": "sess_xxx",
  "request_type": "delete"
}
```

### GET /api/docs - Documentation API

```bash
# Obtenir la documentation OpenAPI complète
GET /api/docs
```

## 🔐 Authentification

L'API supporte deux méthodes d'authentification :

**1. Token API (Bearer Token)**
```
Authorization: Bearer sia_abc123def456...
```
- Permissions : `read`, `write`, `admin`
- Créé via `/api/auth/token`

**2. Secret Administrateur**
```
x-admin-secret: YOUR_ADMIN_SECRET
```
- Pour les opérations sensibles (création de tokens, suppression RGPD)

## 📁 Structure du Projet

```
nextjs_space/
├── app/
│   ├── api/chat/route.ts    # API principale
│   ├── page.tsx             # Interface chat
│   └── layout.tsx           # Layout racine
├── lib/
│   ├── types.ts             # Types TypeScript
│   ├── intent-classifier.ts # Classification d'intentions
│   ├── session-manager.ts   # Gestion des sessions
│   └── db.ts                # Client Prisma
├── prisma/
│   └── schema.prisma        # Schéma base de données
├── scripts/
│   ├── seed.ts              # Seed Coran + Hadiths
│   └── seed-imams.ts        # Seed ouvrages Imams
└── components/              # Composants UI
```

## 🔧 Variables d'Environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `ABACUSAI_API_KEY` | Clé API pour le LLM |

## 📊 Schéma de Base de Données

- **DocumentChunk** : Fragments de textes indexés
- **ChatSession** : Sessions utilisateur avec métadonnées
- **ChatMessage** : Historique des échanges

## 🚀 Déploiement

### Vercel

1. Connectez votre dépôt GitHub à Vercel
2. Configurez les variables d'environnement
3. Déployez !

### Docker (optionnel)

```bash
docker build -t sia-chatbot .
docker run -p 3000:3000 sia-chatbot
```

## 📄 Licence

MIT License - Voir [LICENSE](LICENSE)

## 👤 Auteur

Développé avec ❤️ par [arkocom](https://github.com/arkocom)

---

**⚠️ Version Alpha** - En cours d'essais et de validation par les institutions en vigueur.
