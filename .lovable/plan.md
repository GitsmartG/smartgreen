## Contexto e por que Edge Function (Supabase) e não server function

O app roda em TanStack Start → Cloudflare Workers. O `fetch` do Worker **não suporta proxy HTTP CONNECT**, e a Bright Data (e qualquer proxy residencial de casa de apostas) precisa disso. Supabase Edge Functions rodam em **Deno**, que suporta proxy nativo via `Deno.createHttpClient({ proxy: {...} })`. Por isso essa feature específica vai ficar como Edge Function — o resto do app continua em `createServerFn`.

Vou precisar ligar **Lovable Cloud** (Supabase) primeiro pra ter Edge Functions e Secrets.

## Escopo

1. Habilitar Lovable Cloud.
2. Cadastrar segredos: proxy (host, porta, user, pass) e keys do FeedOdds por parceiro.
3. Criar Edge Function `bet-tips`.
4. Refatorar o modal de Novo Ticket pra chamar a Edge Function em vez do `lookupBetInFeed` atual.

## Estrutura da Edge Function

Arquivo: `supabase/functions/bet-tips/index.ts`

Entrada (POST JSON):
```json
{ "parceiro": "seubet" | "h2bet", "url": "https://..." }
```

Fluxo interno:

```text
1. parseUrl(url, parceiro)
   → extrai { sport, region, competitionId, gameId, betId }
   → valida que a URL bate com o parceiro

2. fetchFeedGame({parceiro, gameId})
   → chama https://feedodds.com/feed/json?brandId=X&key=Y (via proxy)
   → navega o JSON e devolve dados do jogo (times, competição, data, esporte)

3. fetchBilheteHtml({parceiro, url, betId})
   → GET na URL do bilhete via proxy Bright Data
   → aplica extractMarketAndOdd() no HTML

4. Monta e devolve:
   {
     time_casa, time_visitante, competicao, esporte,
     data_jogo, mercado, odd,
     titulo_sugerido: "<time_casa> x <time_visitante> — <mercado>"
   }
```

## Proxy Bright Data

Segredos:
- `PROXY_HOST`, `PROXY_PORT`, `PROXY_USER`, `PROXY_PASS`

Helper único no arquivo:

```ts
const proxyClient = Deno.createHttpClient({
  proxy: {
    url: `http://${Deno.env.get("PROXY_HOST")}:${Deno.env.get("PROXY_PORT")}`,
    basicAuth: {
      username: Deno.env.get("PROXY_USER")!,
      password: Deno.env.get("PROXY_PASS")!,
    },
  },
});

async function proxiedFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...init, client: proxyClient });
}
```

Tudo que sai pra internet passa por `proxiedFetch`.

## Mapeamento parceiro → FeedOdds

Segredos:
- `FEEDODDS_SEUBET_BRAND_ID`, `FEEDODDS_SEUBET_KEY`
- `FEEDODDS_H2BET_BRAND_ID`, `FEEDODDS_H2BET_KEY`

Dentro do código:
```ts
const FEED = {
  seubet: { brandId: Deno.env.get("FEEDODDS_SEUBET_BRAND_ID"), key: Deno.env.get("FEEDODDS_SEUBET_KEY") },
  h2bet:  { brandId: Deno.env.get("FEEDODDS_H2BET_BRAND_ID"),  key: Deno.env.get("FEEDODDS_H2BET_KEY")  },
};
```

## Parser da URL

Baseado no exemplo `.../pre-jogo/match/Soccer/World/2969/30151671?bet_id=6427357511`:

```ts
// /match/<sport>/<region>/<competitionId>/<gameId>
const m = url.pathname.match(/\/match\/([^/]+)\/([^/]+)\/(\d+)\/(\d+)/i);
// sport = m[1], region = m[2], competitionId = m[3], gameId = m[4]
const betId = url.searchParams.get("bet_id");
```

Se algum path segment mudar entre SeuBet e H2Bet, uso um mapa `PARSERS[parceiro]` com o regex certo.

## Parser do HTML do bilhete (ponto a alinhar contigo)

Casa de apostas moderna é SPA — geralmente o HTML tem um `<script>` com o state inicial (Nuxt: `__NUXT__`, Next: `__NEXT_DATA__`, ou Betconstruct: `window.INIT_STATE`). Vou tentar nessa ordem:

1. Regex por JSON embutido: `/<script[^>]*>window\.__(NUXT|NEXT|INIT_STATE)__\s*=\s*(\{.*?\})<\/script>/s`
2. Se achar, navega o objeto atrás do mercado que casa com o `bet_id` (que também aparece no state) e extrai `market_name` + `price`/`coefficient`.
3. Fallback: regex direto no HTML procurando o `bet_id` próximo a um número decimal (odd).

**Preciso de você:** cola aqui o HTML de um bilhete real do SeuBet e outro do H2Bet (view-source da URL) pra eu confirmar em qual variável tá o state. Enquanto isso, deixo o extractor com os 3 padrões e um retorno tipo `{ mercado: null, odd: null, htmlSample: "..." }` quando não achar, pra debugar.

## Frontend

- Remove o `lookupBetInFeed` atual (server function que fazia fetch direto do feed).
- No `NovoTicketModal`, o botão "Buscar" agora chama `supabase.functions.invoke("bet-tips", { body: { parceiro, url } })`.
- Result panel: renderiza todos os campos retornados. Se `odd` vier, preenche automático o campo Odd (editável).
- Trata erros do proxy/scraping com mensagem clara ("não consegui ler o bilhete, cola os dados manual").

## Arquivos afetados

```text
supabase/functions/bet-tips/index.ts        (novo)
src/routes/dashboard.dicas.tsx              (troca lookup por invoke da edge fn)
src/lib/feed-odds.functions.ts              (remove — não é mais usado)
```

## Segredos que vou pedir pra você cadastrar

```
PROXY_HOST
PROXY_PORT
PROXY_USER
PROXY_PASS
FEEDODDS_SEUBET_BRAND_ID
FEEDODDS_SEUBET_KEY
FEEDODDS_H2BET_BRAND_ID
FEEDODDS_H2BET_KEY
```

## Ordem de execução

1. Habilitar Lovable Cloud.
2. Você me passa: (a) HTML de um bilhete SeuBet, (b) HTML de um H2Bet, (c) confirma os brandIds/keys que já usamos (`18749911`/`91c6c673...` pro SeuBet e `18749751`/`f3609270...` pro H2Bet) — quer manter os mesmos ou trocar?
3. Cadastro os 8 segredos.
4. Escrevo a Edge Function com o extractor definitivo baseado no HTML real.
5. Troco o modal pra usar a edge function.
6. Testamos com uma URL real de cada casa.

Confirma que posso ligar o Lovable Cloud e me passa o HTML de um bilhete de cada casa (pode ser view-source colado num pastebin ou anexado) que eu já vou tocando o resto.