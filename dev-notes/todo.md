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
- [ ] Attendre que le rate limit Cloudflare de l'IP retombe (429 / `error code: 1015`, causé par les tests) puis tester le flux politico via `npm run dev`.
- [ ] Si 403 persiste → **plan B** : fetch via `child_process` + vrai `curl` (empreinte TLS réelle, avait donné 200).
- [ ] Vérifier que les autres flux ne sont pas impactés par le retry curl UA.