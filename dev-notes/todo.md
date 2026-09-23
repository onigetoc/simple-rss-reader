# Todo

- Parfois impossible de loader un RSS quand meme existant comme: https://www.politico.com/rss/politicopicks.xml (403 Forbidden)??

## Perf scroll / lazy load — diagnostic et fixes

Cause du scroll saccadé **variable selon le flux** (ce n'est pas la longueur de la liste) :
1. **Images** : `extractFirstImage` prend la 1ʳᵉ image du flux, parfois une photo pleine résolution.
   Décodage sur le main thread pendant le scroll (aucun `decoding="async"`).
2. **Cartes YouTube** : `backdrop-blur-xs` + `animate-pulse` par carte (coût × nb de vidéos).
3. **Plancher constant** : header sticky en `backdrop-blur-md` → re-floute à chaque frame.
   ⚠️ Volontairement **conservé** (à mesurer avant de trancher).
4. `transition-all` sur les cartes empêche l'optimisation du chemin de composition.
5. Pas de `content-visibility` → cartes hors écran stylées/peintes quand même.

- [x] `decoding="async"` sur les 3 `<img>` de `FeedItemCard` (sonde + compact + cards).
- [x] `backdrop-blur-xs` retiré du badge YouTube + `animate-pulse` retiré (dot statique).
- [x] `transition-all` → `transition-colors` (compact) / `transition-[border-color,box-shadow]` (cards).
- [x] `content-visibility: auto` + `contain-intrinsic-size: auto_76px` (compact) / `auto_420px` (cards).
- [x] **React Scan** utilisé le temps du diagnostic, puis **retiré** (`npm uninstall react-scan`).
      Pour le remettre : `npm i -D react-scan`, puis dans `main.tsx` :
      `if (import.meta.env.DEV) import('react-scan').then(({ scan }) => scan({ enabled: true }));`
      ⚠️ `react-scan/auto` est **cassé en 0.5.7** (export → `dist/auto.mjs` non publié) → API `scan()` explicite.
      ⚠️ Le paquet tire `react-doctor` (+ oxlint, playwright-core) : ~210 paquets en devDependency.
- [x] Corrigé un **conflit de peer deps préexistant** : `npm install` échouait déjà tout seul car
      `esbuild@^0.25.0` (devDep) vs `vite@8.3.0` qui réclame `^0.27.0 || ^0.28.0` → bump `esbuild@^0.28.0`.

## React Scan — mesure du clic "Show all" (~500 items)

Données : clic sur App (bouton "Show all"), **1458 ms** au total.
- rendu React : **147 ms**
- JS hors rendu React (handlers + commit + effets) : **1252 ms** ← 86 % du coût
- dernier handler → rAF : 6 ms · rAF → commit DOM : 53 ms · commit → frame : 0 ms

Lecture : le problème n'est **pas** le rendu React, c'est le **commit** — monter ~480 cartes
d'un coup ≈ **~25 000 nœuds DOM** (les icônes lucide pèsent lourd : Share2/BookOpen/ExternalLink/
Bookmark/Calendar rendues ~570-620× chacune). Aucune mémoïsation ne supprime ce travail :
seule la virtualisation évite de monter ces nœuds.

Le data a quand même révélé un vrai bug de mémoïsation : `onToggleFavorite:586x` changé sur 586 rendus
alors que `item:566x` → les 20 cartes déjà visibles (= `PAGE_SIZE`) re-rendaient inutilement.

- [x] **React Compiler non activé** (vérifié dans `vite.config.ts`) → la mémoïsation manuelle est légitime.
- [x] `useCallback` sur `handleToggleFavorite` (App.tsx) — sans ça, `memo` était inopérant.
- [x] `memo(FeedItemCard)` (toutes les props sont primitives ou stables).
- [x] **`useEffect` par carte supprimé** → remplacé par l'ajustement d'état au rendu
      (`if (probedUrl !== feedImageCandidate)`). Le prompt React Scan pointe explicitement ce cas :
      en dev, chaque `useEffect` de chaque composant est profilé, et la comparaison des deps n'apparaît
      pas dans le temps de rendu.
- [x] `loading="lazy"` sur la sonde `imageProbe` → stoppe les ~480 fetchs d'images en eager au clic.
      (Ça soigne le **scroll**, pas le clic : le chargement réseau est asynchrone.)

### 2ᵉ mesure (après les fixes ci-dessus)

Clic "Show all" : **944 ms** (contre 1458 ms, **-35 %**) · `FeedItemCard` **586 → 566** rendus
(= les 20 re-renders inutiles de `PAGE_SIZE` éliminés, mémoïsation confirmée).

Deux interactions, deux buckets **différents** — mais la même cause (566 cartes montées) :
- **Clic** → `JavaScript/React Hooks` **784 ms** (React : commit + machinerie de hooks)
- **Scroll rapide** → `JavaScript, DOM updates, Draw Frame` **987 ms**, FPS tombé à **2** (navigateur : layout + paint)

⚠️ En dev, React profile **chaque hook** de chaque composant et React Scan instrumente chaque rendu
(calcul des props changées sur 566 composants) → une partie des 784 ms est du surcoût de mesure.
Pour le chiffre réel : mesurer en **build de production** (`npm run build && npm start`).

- [x] `startTransition` sur "Load 20 more" et "Show all" (App.tsx). Rend le **rendu** interruptible →
      l'UI ne gèle plus. ⚠️ Ne rend **pas** le **commit** interruptible (React commite de façon synchrone) :
      si les 784 ms sont dans le commit, ça ne changera rien. À vérifier par la mesure.

État final : jugé **acceptable** par l'utilisateur. ~600 items qui apparaissent d'un coup = encore un
temps de traitement, mais plus de gel bloquant.

Reste à faire (optionnel, si on veut aller plus loin) :
- [ ] **Virtualisation** (`@tanstack/react-virtual`) = le seul fix structurel des deux buckets
      (clic **et** scroll). Attention : grille responsive (`lanes`) + hauteurs variables (`measureElement`).
- [ ] Header sticky `backdrop-blur-md` : comparer avec/sans (cible les 987 ms de draw au scroll).
- [ ] Mesurer en **production** pour le chiffre réel (sans StrictMode ni React Scan).

Note : les chiffres sont **gonflés en dev** (StrictMode double-invoque rendus et effets, et React Scan
instrumente chaque rendu). La répartition relative est fiable, les valeurs absolues non.

## 403 Politico — résolu

Cause : Cloudflare Bot Management sur `www.politico.com` (pas un problème d'en-têtes ni de géo).
- Node `fetch` (undici/OpenSSL) avec UA navigateur → **403** « Just a moment... »
- Même avec tous les en-têtes navigateur → **403**
- `curl.exe` réel → **200** (puis 429 car trop de requêtes de test)
- Node `fetch` avec UA **`curl/8.9.1`** → passe le contrôle bot (429 au lieu de 403)

Fix appliqué dans `server.ts` : `fetchFeedText()` retente avec `curl/8.9.1` **uniquement sur 403**.
Parser nettoyé (headers/timeout morts retirés car `parseString` n'appelle jamais `parseURL`).

url test : curl -I https://www.politico.com/rss/politicopicks.xml

À faire demain :
- [x] Attendre que le rate limit Cloudflare de l'IP retombe (429 / `error code: 1015`, causé par les tests) puis tester le flux politico via `npm run dev`.
      → rate limit retombé, flux OK : **200**, 37 articles, titres/liens/images parsés.
- [x] Si 403 persiste → **plan B** : inutile, le retry UA `curl/8.9.1` suffit (vérifié : UA navigateur → 403, UA curl → 200).
- [x] Vérifier que les autres flux ne sont pas impactés par le retry curl UA.
      → BBC, The Verge, Ars Technica, HNRSS, YouTube : tous OK (le retry ne se déclenche que sur 403).
- [x] Bonus : mémo par hôte (`curlUaHosts` dans `server.ts`) pour repartir directement en UA curl
      après un premier 403 — évite de renvoyer une requête vouée au challenge Cloudflare à chaque refresh
      (c'est ce qui avait déclenché le rate limit 1015). 1040 ms → 496 ms au 2ᵉ chargement.

Note : le fix n'était pas encore chargé côté serveur — un `npm run dev` qui tournait depuis la veille
utilisait l'ancien code (`EADDRINUSE` au redémarrage). Penser à **redémarrer le serveur** après modif de `server.ts`
(`tsx server.ts` n'est pas en mode watch).

Note : un `429 Too Many Requests` a été observé dans les logs serveur après une session de tests
intensive (refreshs répétés). C'est le rate limit Cloudflare — le retry UA curl ne le contourne pas,
il faut attendre qu'il retombe. Le fix `curlUaHosts` évite d'en rajouter à chaque refresh.