# Guide de Déploiement SIA

## Prérequis

- Node.js 18+
- PostgreSQL 14+
- Yarn ou npm

## Installation locale

```bash
# Cloner le repository
git clone https://github.com/VOTRE_USERNAME/sia-rag-chatbot.git
cd sia-rag-chatbot

# Installer les dépendances
yarn install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Générer le client Prisma
yarn prisma generate

# Appliquer les migrations
yarn prisma migrate deploy

# Peupler la base de données
yarn prisma db seed

# Lancer en développement
yarn dev
```

## Déploiement avec Antigravity

1. **Ouvrir le projet** dans Google Antigravity
2. **Configurer la base de données** (Supabase, PlanetScale, ou PostgreSQL hébergé)
3. **Définir les variables d'environnement** dans le panneau de déploiement
4. **Déployer** via Firebase, Google Cloud, Vercel, ou Netlify

## Déploiement manuel

### Vercel
```bash
vercel --prod
```

### Google Cloud Run
```bash
gcloud run deploy sia-chatbot --source .
```

### Docker
```bash
docker build -t sia-chatbot .
docker run -p 3000:3000 --env-file .env sia-chatbot
```

## Variables d'environnement requises

| Variable | Description | Exemple |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://...` |
| `ABACUSAI_API_KEY` | Clé API LLM | `sk-...` |
| `ADMIN_SECRET` | Secret admin | `openssl rand -hex 32` |
| `NEXTAUTH_URL` | URL de l'app | `https://sia.example.com` |
| `NEXTAUTH_SECRET` | Secret NextAuth | `openssl rand -hex 32` |

## Base de données recommandées

- **Supabase** (gratuit, PostgreSQL managé)
- **PlanetScale** (MySQL serverless)
- **Neon** (PostgreSQL serverless)
- **Railway** (PostgreSQL simple)

## Support

Contact: nicolasdubois.info@gmail.com
