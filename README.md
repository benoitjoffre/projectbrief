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

## Questionnaire client partageable

Depuis l'onglet **Découverte** d'un projet, « Générer un lien client » crée une URL `/q/<jeton>` à envoyer au client.

- **Jeton** : 256 bits (`crypto.randomBytes`), seul son hash SHA-256 est stocké (`questionnaire_shares`). Le lien complet n'est affiché
  qu'une fois ; en cas de perte, en générer un nouveau (l'ancien est désactivé). Un lien désactivé ou inconnu répond toujours 404.
- **Réponses partagées** : le client écrit dans les mêmes `answers` que le développeur. Il ne peut pas « valider » une réponse
  (`isReviewed` reste réservé à l'administrateur) et voit uniquement le nom du projet, les questions actives et les réponses du projet.
- **Terminer** : verrouille les réponses pour ce lien (idempotent). Générer un nouveau lien rouvre le questionnaire.
- **Limitation de débit** (API publique, en mémoire, par IP) : 300 requêtes/min, et 20 jetons invalides/10 min. Derrière un reverse proxy,
  définir `TRUST_PROXY` (ex. `1`), sinon toutes les requêtes partagent l'IP du proxy.

### Risque d'écrasement (client et développeur modifient la même question)

Les deux écrivent la même ligne. Sans précaution, la dernière écriture gagnerait silencieusement. Protection mise en place :
chaque écriture envoie `expectedUpdatedAt` (la version vue). Si la réponse a changé entre-temps, le serveur refuse (`409 STALE_WRITE`,
avec la version courante) et l'interface affiche un conflit : **garder ma version** ou **reprendre la version enregistrée**.
Sans `expectedUpdatedAt`, l'API d'administration garde l'ancien comportement (dernière écriture gagnante).
Limite : la comparaison se fait à la milliseconde.

### Avant un déploiement public

Les routes d'administration (`/api/*` hors `/api/public`) n'ont **pas d'authentification utilisateur**. Garde-fou fourni : définir
`ADMIN_API_TOKEN` (obligatoire si `NODE_ENV=production`) ; l'API exige alors `Authorization: Bearer <jeton>`. Le front peut l'envoyer via
`VITE_ADMIN_TOKEN`, mais cette variable est lisible dans le bundle : c'est un dépannage, pas une authentification. Prévoir une vraie
authentification (ou un reverse proxy authentifiant) avant toute exposition publique, et servir l'application en HTTPS (le jeton est dans l'URL).
