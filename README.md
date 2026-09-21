# RSS Viewer 📰

Un lecteur de flux RSS et Atom moderne, rapide et épuré, conçu pour une lecture confortable avec prise en charge directe des paramètres d'URL, extraction de médias (images et vidéos YouTube), mode lecteur immersif et agrégation multi-flux en mémoire.

---

## ✨ Fonctionnalités principales

### 🔗 Passerelle d'URL directe & Extensions Chrome
- **Paramètre `?rss=`** : Chargez directement n'importe quel flux en ouvrant `/?rss=https://exemple.com/feed.xml`.
- **Intégration Extension / Bookmarklet** : Compatible avec les extensions de navigateur (Chrome, Firefox) et les bookmarklets en un clic pour envoyer le flux de la page courante directement dans le lecteur.

### 📚 Vue agrégée « ALL Feeds »
- **Flux combinés en mémoire** : Rassemble et déduplique tous les flux RSS consultés pendant votre session.
- **Tri chronologique** : Les articles sont triés du plus récent au plus ancien, toutes sources confondues.
- **Pagination par 20 articles** : Affichage initial de 20 articles avec boutons *« Charger 20 de plus »*, *« Tout afficher »* et *« Réinitialiser à 20 »*.
- **Échantillons préchargés** : Bouton pour injecter en un clic une sélection de flux d'actualités technologiques (The Verge, Ars Technica, Hacker News, GitHub Blog).

### 📖 Lecteur d'article complet (Reader View)
- **Lecture immersive sans distraction** : Affiche le texte complet, les images et les vidéos intégrées.
- **Raccourcis clavier** :
  - `←` / `→` : Passer à l'article précédent ou suivant.
  - `Échap` : Retourner à la liste des articles.
  - Taille de police ajustable (`A` / `A+`).
- **Liens sécurisés en nouvel onglet** : Tous les liens présents dans le contenu s'ouvrent systématiquement dans un nouvel onglet (`target="_blank"` avec `rel="noopener noreferrer"`).
- **Vidéos & Miniatures YouTube** : Affichage de la miniature haute qualité avec lecteur vidéo optimisé.

### 🎨 Thème Sombre / Clair & Personnalisation
- **Sélecteur de thème** : Bascule instantanée entre le mode sombre (Dark) et le mode clair (Light) via l'icône Soleil/Lune.
- **Persistance** : Sauvegarde automatique de votre préférence de thème dans `localStorage`.
- **Barres de défilement stylisées** : Barres de défilement adaptées aux couleurs de chaque thème.
- **Deux modes d'affichage** : Grille de cartes (`Cards`) ou liste compacte (`Compact`).

### 💾 Favoris & Historique local
- **Marque-pages** : Enregistrez vos articles préférés localement pour les retrouver à tout moment.
- **Historique récent** : Accès rapide aux derniers flux consultés avec possibilité de les supprimer.
- **Recherche en direct** : Filtrage instantané par mot-clé, titre ou auteur dans le flux actif ou dans « ALL Feeds ».

---

## 🛠️ Stack technique

- **Frontend** :
  - [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
  - [Vite](https://vite.dev/)
  - [Tailwind CSS v4](https://tailwindcss.com/)
  - [Lucide React](https://lucide.dev/) (Icônes)
- **Backend & Proxy RSS** :
  - [Express](https://expressjs.com/) (Node.js)
  - [rss-parser](https://github.com/rbren/rss-parser) v3.13 (Analyse XML RSS / Atom / RDF avec extraction des balises médias)
  - Mécanisme de secours CORS côté client (`allorigins`) en cas de restriction réseau.

---

## 🚀 Démarrage rapide

### Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)
- `npm` ou `bun`

### Installation

1. **Cloner le dépôt ou ouvrir le répertoire** :
   ```bash
   git clone <URL_DU_DEPOT>
   cd <NOM_DU_DOSSIER>
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Lancer le serveur de développement** :
   ```bash
   npm run dev
   ```
   L'application sera accessible sur `http://localhost:3000`.

---

## 📦 Scripts disponibles

| Commande | Description |
| :--- | :--- |
| `npm run dev` | Démarre le serveur backend Express avec le middleware Vite en mode développement (sur le port 3000) |
| `npm run build` | Compile le frontend avec Vite et bundle le backend TypeScript avec esbuild dans `dist/server.cjs` |
| `npm start` | Lance le serveur de production compilé |
| `npm run lint` | Valide les types TypeScript (`tsc --noEmit`) |
| `npm run clean` | Supprime le dossier de compilation `dist` |

---

## 🔌 Utilisation avec une extension Chrome ou un Bookmarklet

### Via l'URL
Ajoutez simplement le flux RSS souhaité en paramètre d'URL :
```text
http://localhost:3000/?rss=https://news.ycombinator.com/rss
```

### Via un Bookmarklet (Favori navigateur)
Créez un nouveau favori dans votre navigateur et collez le code suivant dans l'adresse (URL) :
```javascript
javascript:(function(){
  var link = document.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]');
  var rssUrl = link ? link.href : window.location.href;
  window.open('https://VOTRE_DOMAINE/?rss=' + encodeURIComponent(rssUrl), '_blank');
})();
```

---

## 📄 Licence

Ce projet est sous licence libre. Consultez le code source pour plus de détails.
