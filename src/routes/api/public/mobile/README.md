# Mobile API — Documentação Completa

**Base URL (prod):** `https://project--c096dbe0-6220-45f5-8f8c-325c5268b8e1.lovable.app`
**Base URL (dev):**  `https://project--c096dbe0-6220-45f5-8f8c-325c5268b8e1-dev.lovable.app`

- Todas as respostas são `application/json`.
- CORS liberado pra domínios `*.lovable.app`, `*.vercel.app` e localhost.
- Formato padrão de resposta: `{ "ok": true, ... }` ou `{ "ok": false, "error": "mensagem" }`.
- Timezone de datas de partidas: **`America/Sao_Paulo` (BRT)**.

---

## 🔐 Autenticação

### 1. Auth de USUÁRIO (login/signup)
Rotas `/mobile/signup` e `/mobile/login` **NÃO** exigem API key — retornam token de sessão do usuário.

### 2. Auth de APP (API Key)
Todas as rotas de **dados** (partidas, escalações, notificações, etc.) exigem uma **API key**
gerada no painel admin, aba **Configurações → API Mobile**.

Envie a chave em **qualquer** uma dessas formas (a primeira que existir vale):

| Método       | Exemplo                                         |
|--------------|-------------------------------------------------|
| Header       | `X-API-Key: sk_xxxxxxxx`                        |
| Bearer       | `Authorization: Bearer sk_xxxxxxxx`             |
| Query param  | `?api_key=sk_xxxxxxxx`                          |

Se faltar ou for inválida → `401 { "ok": false, "error": "..." }`.

---

## 👤 Usuário

### `POST /api/public/mobile/signup`
Cria conta. Todo mundo vira `role: "user"`.

```jsonc
// Body
{ "email": "fulano@ex.com", "password": "senha123", "name": "Fulano" }

// 200
{
  "ok": true,
  "access_token": "eyJ...",
  "refresh_token": "xxx",
  "expires_at": 1736380800,
  "user": { "id": "uuid", "email": "fulano@ex.com", "role": "user" },
  "needs_email_confirmation": false
}
```

### `POST /api/public/mobile/login`
```jsonc
// Body
{ "email": "fulano@ex.com", "password": "senha123" }

// 200 — igual signup + "expires_in": 3600
```

Erros comuns: `400` dados inválidos · `401` senha errada.

Guarde `access_token` + `refresh_token` num storage seguro (Keychain / EncryptedSharedPreferences / `expo-secure-store`).
Renove via endpoint padrão do Supabase Auth quando `expires_at` chegar.

---

## ⚽ Partidas

### `GET /api/public/mobile/matches/today`
Jogos de hoje (BRT). Auto-refresh a cada ~60s no servidor.

### `GET /api/public/mobile/matches/live`
Só jogos ao vivo agora, com placar e minuto atualizado.

### `GET /api/public/mobile/matches/by-date?date=<alias|YYYY-MM-DD>`
Aceita `today`, `hoje`, `yesterday`, `ontem`, `tomorrow`, `amanha`, `amanhã` **ou** `2026-01-15`.
Range permitido: **±7 dias** do dia atual.

```jsonc
// GET /api/public/mobile/matches/by-date?date=tomorrow
{
  "ok": true,
  "count": 42,
  "date": "2026-07-11",
  "offset": 1,        // dias em relação a hoje (-7..+7)
  "isToday": false,
  "cached": false,
  "fetchedAt": "2026-07-10T18:30:00Z",
  "matches": [ /* MatchDTO[] — ver abaixo */ ]
}
```

### Shape do `MatchDTO`

```ts
{
  id: string;
  alternateIds: string[];
  league: string;
  leagueId: string;
  country: string;
  status: "scheduled" | "live" | "finished";
  rawStatus: string;              // "1H", "HT", "45+2'", "FT", etc
  minute: string | null;          // "67", "45+2", "HT" ou null
  kickoff: string | null;         // ISO UTC
  startMs: number | null;         // epoch ms
  venue: string | null;
  team1: { id: string|null; name: string; logo: string|null };
  team2: { id: string|null; name: string; logo: string|null };
  team1Logo: string | null;       // atalho
  team2Logo: string | null;
  score1: number | null;
  score2: number | null;
  live: boolean;
  finished: boolean;
  hasLiveStats: boolean;
  events: [
    { id, type: "goal"|"yellowcard"|"redcard"|"substitution"|...,
      team: "home"|"away", minute, extraMin, player, assist, result }
  ]
}
```

- `logo` já vem como URL absoluta e pública — pode usar direto no `<Image />`.
- Datas passadas ficam em cache permanente; hoje/futuro tem TTL de 60s.

---

## 🧠 Escalações (Lineups) — **NOVO**

### `GET /api/public/mobile/lineups/{matchId}`
Puxa titulares, reservas, formação, técnico e desfalques dos dois times.
Use o `id` do `MatchDTO`.

```jsonc
// 200
{
  "ok": true,
  "status": "confirmed",   // ou "predicted"
  "updated": "2026-07-10T17:45:00Z",
  "home": {
    "team_id": "123",
    "team_name": "Palmeiras",
    "team_formation": "4-3-3",
    "coach": { "id": "77", "name": "Abel Ferreira" },
    "confidence": 92,
    "starting_xi": [
      { "id": "9001", "name": "Weverton", "number": "21", "position": "GK" },
      /* ...11 */
    ],
    "bench": [
      { "id": "9020", "name": "Marcelo Lomba", "number": "1", "position": "GK" },
      /* ... */
    ],
    "sidelined": [
      { "id": "9099", "name": "Dudu", "position": "FW",
        "status": "Injured", "reason": "Knee injury" }
    ]
  },
  "away": { /* mesma estrutura */ }
}
```

**Limitações da fonte (Statpal):**
- Fotos de jogadores individuais **não** são retornadas por esse endpoint.
- Estatísticas por jogador (gols, assistências, ratings) **não** vêm aqui — o que temos é a lista `events[]` do `MatchDTO` (quem fez gol, cartão, substituição, com minuto).
- Confirmação da escalação normalmente sai **~1h antes do apito inicial**. Antes disso vem `status: "predicted"`.

Erros:
- `404 { "ok": false, "error": "Escalação não disponível para essa partida" }`
- `500` se `STATPAL_API_KEY` não estiver configurada.

---

## 🎯 Previsão / Palpite (Prediction) — **NOVO**

### `GET /api/public/mobile/prediction/{matchId}`
Palpite oficial da fonte + odds pré-jogo. Nem toda liga tem — ligas menores retornam `404`.

```jsonc
// 200
{
  "ok": true,
  "meta": {
    "date": "2026-07-11",
    "time": "21:30",
    "home_team": { "id": "123", "name": "Palmeiras" },
    "away_team": { "id": "456", "name": "Flamengo" },
    "league":   { "name": "Brasileirão Série A" },
    "country":  { "name": "Brazil" },
    "venue":    { "name": "Allianz Parque", "city": "São Paulo" }
  },
  "prediction": {
    "choice": "Palmeiras to win",
    "reasoning": "Palmeiras...",
    "prematch_odds": {
      "market": "Match Winner",
      "modifier": "Full Time",
      "selection": "Home",
      "odd": "1.85"
    }
  }
}
```

> Se quiser tradução PT-BR automática, o painel web já tem — pra API pura entregamos o texto original.

---

## 📰 Storylines (Notícias do Jogo)

### `GET /api/public/mobile/news/{matchId}`
Insights, quotes e narrativas editoriais do jogo (Statpal `live-storylines`).
Só ligas grandes (Champions, Premier League, Serie A, La Liga…) costumam ter conteúdo — as menores devolvem `404`.

```jsonc
// 200
{
  "ok": true,
  "meta": { /* metadados do jogo */ },
  "storylines": [ /* array de objetos com título + corpo */ ]
}
```

---

## 🔔 Notificações ao Vivo

### `GET /api/public/mobile/notifications/live?since=<ISO>&limit=100`
Feed persistente de eventos (gols, cartões, início/fim de partida). Alimentado por cron a cada minuto — funciona mesmo com o painel web fechado.

- `since` (opcional): ISO 8601. Só retorna eventos com `fetchedAt > since`.
- `limit` (opcional, default 100, max 500).

```jsonc
// 200
{
  "ok": true,
  "count": 8,
  "serverTime": "2026-07-10T18:32:00Z",
  "notifications": [
    {
      "id": "match123:event:evt789",
      "matchId": "match123",
      "kind": "goal",           // goal | card | event | live | finish
      "type": "goal",
      "title": "Gol do Palmeiras",
      "text": "67' goal · Palmeiras · Endrick (2-1)",
      "league": "Brasileirão",
      "leagueId": "71",
      "minute": "67",
      "team": "home",
      "player": "Endrick",
      "result": "2-1",
      "score1": 2, "score2": 1,
      "status": "live", "rawStatus": "2H",
      "live": true, "finished": false,
      "team1": { "id": "...", "name": "Palmeiras", "logo": "https://..." },
      "team2": { "id": "...", "name": "Flamengo",  "logo": "https://..." },
      "fetchedAt": "2026-07-10T18:31:45Z"
    }
  ]
}
```

**Padrão de polling recomendado:**
1. Ao abrir o app, chame **sem** `since` → pega backlog.
2. Guarda o `serverTime` da resposta.
3. A cada 15–30s, chama de novo com `since=<serverTime_anterior>` e faz merge.

---

## 🖼️ Banners da Home

### `GET /api/public/mobile/banners`
Lista os banners **ativos** ordenados (`sort_order` asc, mais novos depois). Cache 60s.

- Tamanho recomendado da imagem: **1200 × 480 px** (proporção 5:2, JPG ou PNG).
- Banners podem estar hospedados no bucket privado do backend (URLs assinadas de 7 dias) **ou** em URL externa colada pelo admin. Nos dois casos, o campo `image_url` já vem pronto pra usar no `<Image />`.

```jsonc
// 200
{
  "ok": true,
  "count": 3,
  "banners": [
    {
      "id": "b1c9-uuid",
      "title": "Promo Copa",           // opcional (uso interno)
      "image_url": "https://.../banner.jpg", // URL absoluta pronta pra usar
      "link_url": "https://h2.bet.br/promo",  // pode ser null
      "button_label": "Apostar agora",  // null quando NÃO tem botão
      "has_button": true,               // atalho boolean
      "sort_order": 0
    },
    {
      "id": "b2d0-uuid",
      "title": null,
      "image_url": "https://.../banner2.jpg",
      "link_url": "https://parceiro.com",
      "button_label": null,
      "has_button": false,
      "sort_order": 1
    }
  ]
}
```

**Como o app mobile deve renderizar:**

| Cenário                    | `has_button` | `button_label` | Comportamento no app                                                             |
|----------------------------|--------------|----------------|-----------------------------------------------------------------------------------|
| Banner clicável inteiro    | `false`      | `null`         | O banner INTEIRO é clicável. Ao tocar, abre `link_url` (se existir).             |
| Banner com botão dedicado  | `true`       | `"..."`        | Só o botão sobre o banner abre `link_url`. Tocar fora do botão **não** navega.   |
| Banner sem link            | qualquer     | qualquer       | Se `link_url` é `null`, não navega — apenas exibe.                               |

Abrir `link_url`:
- `http(s)://...` → abrir no navegador (in-app browser ideal).
- Você pode aceitar deep-links customizados no futuro (ex.: `smartgreen://tickets/123`).

---


### `GET /api/public/mobile/tickets`
Lista de tickets publicados.

### `GET /api/public/mobile/tickets/{id}`
Detalhe de um ticket.

---

## 🖼️ Assets

### `GET /api/public/team-image/{teamId}`
Logo do time em PNG/JPG. Cacheado pelo servidor. Já vem embutido nos campos `logo` do `MatchDTO`.

---

## 📋 Códigos de Status

| Código | Significado                                         |
|--------|-----------------------------------------------------|
| 200    | Sucesso                                             |
| 400    | Payload/query inválido (ex.: data fora do formato)  |
| 401    | API key faltando ou inválida                        |
| 404    | Recurso não encontrado (ex.: prediction indisponível) |
| 429    | Rate limit da fonte (Statpal) — tente de novo em ~30s |
| 500    | Erro interno / config faltando                      |
| 502    | Fonte externa (Statpal) fora do ar                  |

---

## 🧪 Exemplos cURL

```bash
BASE="https://project--c096dbe0-6220-45f5-8f8c-325c5268b8e1.lovable.app"
KEY="sk_sua_chave_aqui"

# Cadastro
curl -X POST "$BASE/api/public/mobile/signup" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste@ex.com","password":"senha123","name":"Teste"}'

# Login
curl -X POST "$BASE/api/public/mobile/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste@ex.com","password":"senha123"}'

# Jogos de amanhã
curl "$BASE/api/public/mobile/matches/by-date?date=tomorrow" \
  -H "X-API-Key: $KEY"

# Jogo específico (data custom)
curl "$BASE/api/public/mobile/matches/by-date?date=2026-07-15" \
  -H "X-API-Key: $KEY"

# Escalação
curl "$BASE/api/public/mobile/lineups/12345" -H "X-API-Key: $KEY"

# Previsão
curl "$BASE/api/public/mobile/prediction/12345" -H "X-API-Key: $KEY"

# Storylines
curl "$BASE/api/public/mobile/news/12345" -H "X-API-Key: $KEY"

# Notificações (com since)
curl "$BASE/api/public/mobile/notifications/live?since=2026-07-10T18:00:00Z" \
  -H "X-API-Key: $KEY"
```

---

## 🚨 Sobre dados de jogadores (leia isto!)

O que **conseguimos** entregar hoje via Statpal:
- ✅ Nome do jogador, número da camisa, posição, ID
- ✅ Time titular e reservas
- ✅ Formação tática (4-4-2, 3-5-2, etc.)
- ✅ Nome e ID do técnico
- ✅ Desfalques com motivo (lesão, suspensão)
- ✅ Eventos do jogo com autor (quem fez gol, cartão, entrou/saiu)

O que a **fonte NÃO fornece** nesse plano:
- ❌ Foto de rosto do jogador
- ❌ Estatísticas históricas por jogador (gols na temporada, ratings)
- ❌ Perfil biográfico

Se precisar de fotos/perfis de jogadores, dá pra plugar uma segunda fonte
(Sofascore/Transfermarkt scraping, ou API-Football tier pago) — só me avisar
que a gente monta.
