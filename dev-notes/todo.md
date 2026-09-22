# Todo

- Parfois impossible de loader un RSS quand meme existant comme: https://www.politico.com/rss/politicopicks.xml (403 Forbidden)??

## 403 Politico — diagnostic (fait) et à finir demain

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
- [ ] Image Lazy load react.

Note : le fix n'était pas encore chargé côté serveur — un `npm run dev` qui tournait depuis la veille
utilisait l'ancien code (`EADDRINUSE` au redémarrage). Penser à **redémarrer le serveur** après modif de `server.ts`
(`tsx server.ts` n'est pas en mode watch).