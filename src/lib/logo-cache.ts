// Cache persistente (localStorage) de logos de times por nome normalizado.
// Uma vez que uma logo foi carregada de qualquer fonte (feed, statpal, etc.),
// guardamos aqui e reusamos — evita re-fetch a cada render/refresh.

const KEY = "sg_logo_cache_v1";
const MAX_ENTRIES = 500;

type Entry = { url: string; ts: number };
type Store = Record<string, Entry>;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(store);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } else {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    }
  } catch {
    // quota exceeded etc — ignora silencioso
  }
}

export function getCachedLogo(name?: string | null): string | undefined {
  if (!name) return undefined;
  const key = normalize(name);
  if (!key) return undefined;
  const store = readStore();
  return store[key]?.url;
}

export function setCachedLogo(name: string | null | undefined, url: string | null | undefined) {
  if (!name || !url || typeof url !== "string") return;
  const trimmed = url.trim();
  if (!trimmed) return;
  // Não cacheia data-URIs (flags) — são gerados sob demanda e ocupam espaço.
  if (trimmed.startsWith("data:")) return;
  const key = normalize(name);
  if (!key) return;
  const store = readStore();
  const prev = store[key];
  if (prev?.url === trimmed) return;
  store[key] = { url: trimmed, ts: Date.now() };
  writeStore(store);
}

export function markLogoBroken(name?: string | null, url?: string | null) {
  if (!name || !url) return;
  const key = normalize(name);
  if (!key) return;
  const store = readStore();
  if (store[key]?.url === url) {
    delete store[key];
    writeStore(store);
  }
}
