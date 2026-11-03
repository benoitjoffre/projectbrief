# ProjectBrief

Application personnelle de cadrage de projets (clients, projets, entretiens, cahier des charges).

> ⚠️ **Aucune authentification** : ne pas déployer publiquement sans protection d'accès
> (VPN, reverse proxy avec authentification, etc.).

## Démarrage

```bash
npm install
cp apps/api/.env.example apps/api/.env   # puis ajuster si besoin
npm run db:up                            # PostgreSQL (docker, 127.0.0.1:5434)
npm run db:migrate                       # applique les migrations
npm run dev:api                          # API  : http://localhost:3001
npm run dev:web                          # Web  : http://localhost:5173
```

Tests : créer une fois la base `projectbrief_test`, migrer, puis `npm test`.

```bash
docker compose exec db psql -U projectbrief -c 'CREATE DATABASE projectbrief_test'
npm run db:migrate:test -w apps/api
npm test
```
