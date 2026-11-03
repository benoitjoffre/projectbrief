'use strict';

const { createHash } = require('node:crypto');

// UUID déterministe (v5-like) dérivé d'une clé stable : le re-seed retrouve toujours les mêmes lignes.
function stableId(key) {
  const h = createHash('sha1').update(`projectbrief:${key}`).digest('hex');
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

const CATEGORIES = [
  {
    key: 'client-activite',
    title: 'Client et activité',
    questions: [
      'Quelle est votre activité et qui sont vos clients ?',
      'Pourquoi souhaitez-vous lancer ce projet maintenant ?',
      'Comment fonctionne votre activité aujourd\'hui ?',
      'Quels outils ou logiciels utilisez-vous déjà ?',
      'Qui sera l\'interlocuteur principal et qui prendra les décisions ?',
    ],
  },
  {
    key: 'probleme-objectifs',
    title: 'Problème et objectifs',
    questions: [
      'Quel problème souhaitez-vous résoudre ?',
      'Comment gérez-vous actuellement ce problème ?',
      'Quelles sont les conséquences de ce problème ?',
      'Qu\'avez-vous déjà essayé pour le résoudre ?',
      'Comment mesurerez-vous la réussite du projet ?',
    ],
  },
  {
    key: 'utilisateurs',
    title: 'Utilisateurs',
    questions: [
      'Qui utilisera la solution au quotidien ?',
      'Combien d\'utilisateurs sont prévus au lancement ?',
      'Quels profils et niveaux d\'accès faudra-t-il ?',
      'Sur quels appareils sera utilisée la solution ?',
      'Quelles sont les trois actions principales des utilisateurs ?',
    ],
  },
  {
    key: 'fonctionnalites',
    title: 'Fonctionnalités',
    questions: [
      'Quelles fonctionnalités sont indispensables dès la V1 ?',
      'Quelles fonctionnalités peuvent attendre ?',
      'Pouvez-vous décrire un parcours utilisateur complet ?',
      'Faut-il des comptes, notifications, paiements ou exports ?',
      'Quelles règles métier et exceptions faut-il prévoir ?',
    ],
  },
  {
    key: 'existant-technique',
    title: 'Existant et technique',
    questions: [
      'Existe-t-il déjà un site, une application ou une API ?',
      'Disposez-vous d\'une documentation de l\'existant ?',
      'Faut-il récupérer ou migrer des données ?',
      'Quels services externes doivent être connectés ?',
      'Quelles contraintes techniques, de sécurité ou RGPD existent ?',
    ],
  },
  {
    key: 'ux-design',
    title: 'UX et design',
    questions: [
      'Avez-vous une identité visuelle ou des maquettes ?',
      'Quels produits ou interfaces appréciez-vous ?',
      'L\'application doit-elle être adaptée au mobile ?',
      'Qui fournira les textes, images et contenus ?',
      'Faut-il prévoir plusieurs langues ou des besoins d\'accessibilité ?',
    ],
  },
  {
    key: 'budget-planning',
    title: 'Budget et planning',
    questions: [
      'Quel budget avez-vous envisagé ?',
      'Existe-t-il une date de lancement impérative ?',
      'Qui validera les livrables ?',
      'À quelle fréquence souhaitez-vous suivre l\'avancement ?',
      'Comment souhaitez-vous gérer les demandes supplémentaires ?',
    ],
  },
  {
    key: 'livraison-maintenance',
    title: 'Livraison et maintenance',
    questions: [
      'Quels critères permettront de valider la livraison ?',
      'Qui réalisera les tests et la recette fonctionnelle ?',
      'Qui prendra en charge l\'hébergement ?',
      'Souhaitez-vous une formation ou une documentation ?',
      'Avez-vous besoin de maintenance après livraison ?',
    ],
  },
];

const categories = CATEGORIES.map((c, i) => ({
  id: stableId(`category:${c.key}`),
  title: c.title,
  sortOrder: i + 1,
}));

const questions = CATEGORIES.flatMap((c, ci) =>
  c.questions.map((label, qi) => ({
    id: stableId(`question:${c.key}:${qi + 1}`),
    categoryId: categories[ci].id,
    label,
    sortOrder: qi + 1,
  })),
);

module.exports = { categories, questions };
