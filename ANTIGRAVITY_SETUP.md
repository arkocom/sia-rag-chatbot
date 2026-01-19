# 🚀 SIA - Guide de Déploiement Antigravity (Google)

## 📋 Prérequis

- Compte Google Cloud avec accès à Antigravity IDE
- Compte Supabase (gratuit) : https://supabase.com
- Clé API Abacus AI (pour le LLM)

---

## 🛠️ Étape 1 : Configuration Supabase

### 1.1 Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un compte
2. Cliquez sur **"New Project"**
3. Configurez :
   - **Nom** : `sia-rag-chatbot`
   - **Mot de passe DB** : choisissez un mot de passe fort
   - **Région** : `eu-west-1` (Europe)
4. Attendez la création (~2 minutes)

### 1.2 Activer pgvector

1. Dans le dashboard Supabase, allez dans **Database** → **Extensions**
2. Recherchez **"vector"**
3. Activez l'extension

### 1.3 Récupérer la Connection String

1. Allez dans **Settings** → **Database**
2. Copiez la **Connection string** (Mode: Session Pooler)
3. Format : `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`

> ⚠️ **Important** : Encodez les caractères spéciaux du mot de passe :
> - `@` → `%40`
> - `&` → `%26`
> - `[` → `%5B`
> - `]` → `%5D`

---

## 🛠️ Étape 2 : Configuration Antigravity

### 2.1 Importer le projet

1. Ouvrez Antigravity IDE
2. Uploadez l'archive `sia-rag-chatbot-antigravity.zip`
3. Ou clonez depuis votre repository

### 2.2 Configurer les variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Base de données Supabase (OBLIGATOIRE)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

# API Abacus AI pour le LLM (OBLIGATOIRE)
ABACUSAI_API_KEY="votre_cle_api_abacus"

# Administration (OBLIGATOIRE)
ADMIN_PASSWORD="VotreMotDePasseAdmin123!"
ADMIN_SECRET="votre_secret_admin_32_caracteres"

# Embeddings (OPTIONNEL - la recherche fonctionne sans)
# Choisir UN provider et configurer sa clé :
# EMBEDDING_PROVIDER="openai"
# OPENAI_API_KEY="sk-..."
# ou
# EMBEDDING_PROVIDER="cohere"
# COHERE_API_KEY="..."
```

### 2.3 Installer les dépendances

```bash
cd nextjs_space
yarn install
```

### 2.4 Initialiser la base de données

```bash
# Générer le client Prisma
yarn prisma generate

# Synchroniser le schéma avec Supabase
yarn prisma db push

# Activer pgvector et créer les index
yarn tsx scripts/setup-pgvector.ts
```

### 2.5 Importer les données

**Option A - Depuis le backup (recommandé)** :
```bash
# Importer les 6 372 sources islamiques depuis backup_data.json
yarn tsx scripts/import-backup.ts
```

**Option B - Depuis les scripts de seed** :
```bash
yarn tsx scripts/seed.ts
yarn tsx scripts/seed-imams.ts
```

---

## 🚀 Étape 3 : Lancement

### Développement
```bash
yarn dev
```
Accédez à http://localhost:3000

### Production
```bash
yarn build
yarn start
```

---

## 📊 Étape 4 : Générer les Embeddings (Optionnel)

La recherche fonctionne déjà très bien avec la recherche full-text PostgreSQL.
Pour améliorer encore la pertinence sémantique :

### Avec Cohere (gratuit)

1. Créez un compte sur [cohere.com](https://cohere.com)
2. Obtenez une clé API gratuite
3. Ajoutez dans `.env` :
   ```
   EMBEDDING_PROVIDER="cohere"
   COHERE_API_KEY="votre_cle_cohere"
   ```
4. Générez les embeddings :
   ```bash
   yarn tsx scripts/generate-embeddings.ts
   ```

### Avec OpenAI (payant mais plus précis)

1. Obtenez une clé API sur [platform.openai.com](https://platform.openai.com)
2. Ajoutez dans `.env` :
   ```
   EMBEDDING_PROVIDER="openai"
   OPENAI_API_KEY="sk-..."
   ```
3. Générez les embeddings :
   ```bash
   yarn tsx scripts/generate-embeddings.ts
   ```

---

## 📚 Endpoints API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/chat` | POST | Chat principal RAG |
| `/api/session` | GET | Info session |
| `/api/docs` | GET | Documentation |
| `/api/escalate` | POST | Escalade humaine |
| `/api/gdpr` | GET/DELETE | Conformité RGPD |
| `/admin` | - | Dashboard admin |

---

## 🔐 Administration

1. Accédez à `/admin`
2. Connectez-vous avec `ADMIN_PASSWORD`
3. Fonctionnalités :
   - Statistiques en temps réel
   - Gestion des escalades
   - Suivi des quotas
   - Export des données

---

## 📁 Structure du Projet

```
sia-rag-chatbot/
├── app/                    # Pages Next.js
│   ├── api/               # Routes API
│   ├── admin/             # Dashboard admin
│   └── page.tsx           # Interface chat
├── lib/                    # Services
│   ├── db.ts              # Prisma client
│   ├── search-service.ts  # Recherche hybride
│   ├── embedding-service.ts # Embeddings
│   └── session-manager.ts # Sessions
├── prisma/
│   └── schema.prisma      # Schéma DB
├── scripts/               # Scripts utilitaires
│   ├── seed.ts            # Données initiales
│   └── generate-embeddings.ts
└── .env.example           # Template config
```

---

## ❓ Support

- **Documentation complète** : `/docs`
- **API Reference** : `/api/docs`
- **Problèmes courants** : voir TROUBLESHOOTING.md

---

## 🌟 Fonctionnalités

- ✅ **6 372 sources** : Coran, Hadiths, Riyad as-Salihin, Al-Ghazali
- ✅ **Recherche hybride** : Full-text + Sémantique (pgvector)
- ✅ **Sessions multi-tours** : Contexte conversationnel
- ✅ **Escalade humaine** : Transfert aux experts
- ✅ **Conformité RGPD** : Export et suppression des données
- ✅ **Dashboard admin** : Statistiques et gestion
