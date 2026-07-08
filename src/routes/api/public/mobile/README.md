# Mobile API — Autenticação

Base URL (prod): `https://project--c096dbe0-6220-45f5-8f8c-325c5268b8e1.lovable.app`
Base URL (dev):  `https://project--c096dbe0-6220-45f5-8f8c-325c5268b8e1-dev.lovable.app`

Todas as rotas aceitam **CORS** (`*`) e respondem `application/json`.
Não precisa mandar `apikey` nem `Authorization` nessas rotas públicas.

---

## POST `/api/public/mobile/signup`

Cria uma conta nova. Signup é aberto — qualquer um pode se cadastrar.
Todo usuário criado por aqui recebe role `user` (só admin do painel pode promover).

### Request
```http
POST /api/public/mobile/signup
Content-Type: application/json

{
  "email": "fulano@email.com",
  "password": "senha123",         // mínimo 6, máximo 128
  "name": "Fulano da Silva"       // opcional
}
```

### Response 200
```json
{
  "ok": true,
  "access_token": "eyJhbGciOi...",   // pode vir null se precisar confirmar email
  "refresh_token": "xxxxxxxx...",    // idem
  "expires_at": 1736380800,
  "user": {
    "id": "uuid",
    "email": "fulano@email.com",
    "role": "user"
  },
  "needs_email_confirmation": false
}
```

### Erros
- `400` — `{ "ok": false, "error": "Dados inválidos" }` (email/senha fora do formato)
- `400` — `{ "ok": false, "error": "User already registered" }` (email já existe)

---

## POST `/api/public/mobile/login`

Autentica email + senha. Retorna a sessão pra guardar no app.

### Request
```http
POST /api/public/mobile/login
Content-Type: application/json

{
  "email": "fulano@email.com",
  "password": "senha123"
}
```

### Response 200
```json
{
  "ok": true,
  "access_token": "eyJhbGciOi...",
  "refresh_token": "xxxxxxxx...",
  "expires_at": 1736380800,
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "fulano@email.com",
    "role": "user"   // ou "admin"
  }
}
```

### Erros
- `400` — `{ "ok": false, "error": "email/senha inválidos" }`
- `401` — `{ "ok": false, "error": "Email ou senha incorretos" }`

---

## Como usar o token no app

Guarda `access_token` + `refresh_token` no storage seguro do device
(Keychain no iOS, EncryptedSharedPreferences no Android, `expo-secure-store` no Expo).

Nas próximas chamadas autenticadas, envie:
```
Authorization: Bearer <access_token>
```

O `access_token` expira (`expires_in` segundos, normalmente 1h).
Quando expirar, use o `refresh_token` pra renovar direto no endpoint padrão
do Supabase Auth — ou peça login de novo.

---

## Exemplo cURL

```bash
# Cadastro
curl -X POST https://project--c096dbe0-6220-45f5-8f8c-325c5268b8e1.lovable.app/api/public/mobile/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste@ex.com","password":"senha123","name":"Teste"}'

# Login
curl -X POST https://project--c096dbe0-6220-45f5-8f8c-325c5268b8e1.lovable.app/api/public/mobile/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste@ex.com","password":"senha123"}'
```
