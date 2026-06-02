# teller-waitlist-email

Serviço transacional que envia email de confirmação após cadastro na waitlist da Teller.

Origem: [`useteller/teller-brain#16`](https://github.com/useteller/teller-brain/issues/16)
Spec: [`teller-brain/initiatives/specs/teller-waitlist-email.md`](../teller-brain/initiatives/specs/teller-waitlist-email.md)

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Drizzle ORM + Neon (Postgres) · Resend · React Email · vitest

## Endpoint

`POST /api/waitlist/joined`

### Headers

```
Content-Type: application/json
X-Teller-Signature: t=<unix_ts>,v1=<hmac_sha256(t + "." + body, SECRET)>
```

### Body

```json
{
  "email": "user@example.com",
  "name": "Fulano",
  "source": "tally",
  "event_id": "evt_abc123"
}
```

| campo      | obrigatório | nota                                                     |
| ---------- | ----------- | -------------------------------------------------------- |
| `email`    | sim         | validado (formato + ≤320 chars)                          |
| `name`     | não         | usado no `Olá, <name>,`                                  |
| `source`   | não         | telemetria (livre)                                       |
| `event_id` | não         | se presente, vira a dedupe key; senão, hash(email)       |

### Respostas

| status                                | quando                                  |
| ------------------------------------- | --------------------------------------- |
| `200 { status: "sent" }`              | primeiro envio bem-sucedido             |
| `200 { status: "noop", reason: "already_sent" }` | dedupe key já existia         |
| `400 { error: "bad_request" }`        | email inválido ou JSON quebrado         |
| `401 { error: "unauthorized", ... }`  | HMAC inválido ou timestamp >5min skew   |
| `500 { error: "send_failed" }`        | Resend ou DB falharam                   |

## Idempotência

- Se `event_id` veio no payload → ele é a chave
- Senão → `sha256(email_lowercased + "|waitlist_joined")`

Tabela `sent_emails` tem `UNIQUE(dedupe_key)`. Edição de copy **nunca** dispara reenvio; reenvio em massa é operação manual fora deste repo.

## Setup local

```sh
# 1. Instalar deps
npm install

# 2. Configurar .env
cp .env.example .env
# preencher DATABASE_URL, RESEND_API_KEY, WAITLIST_EMAIL_HMAC_SECRET
# gerar secret: openssl rand -hex 32

# 3. Aplicar schema no Neon
npm run db:push

# 4. Dev server
npm run dev
```

## Testes

```sh
npm test               # roda 1x
npm run test:watch     # watch mode
npm run typecheck      # tsc --noEmit
```

## Exemplo de chamada (curl)

Gera assinatura HMAC e envia:

```sh
SECRET=$WAITLIST_EMAIL_HMAC_SECRET
BODY='{"email":"voce@example.com","name":"Fulano","source":"manual"}'
T=$(date +%s)
SIG=$(printf "%s.%s" "$T" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

curl -X POST http://localhost:3000/api/waitlist/joined \
  -H "Content-Type: application/json" \
  -H "X-Teller-Signature: t=$T,v1=$SIG" \
  -d "$BODY"
```

## Variáveis de ambiente

| nome                          | descrição                                                       |
| ----------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                | string de conexão Neon (postgres)                               |
| `RESEND_API_KEY`              | API key da Resend                                               |
| `WAITLIST_EMAIL_HMAC_SECRET`  | secret(s) HMAC. Suporta CSV (`a,b`) durante rotação             |
| `WAITLIST_EMAIL_FROM`         | remetente, ex: `Teller <no-reply@useteller.com.br>`             |
| `WAITLIST_EMAIL_REPLY_TO`     | (opcional) reply-to, ex: `oi@useteller.com.br`                  |

## Estrutura

```
app/
  api/waitlist/joined/
    route.ts          # handler POST
    route.test.ts     # e2e mockado
  layout.tsx          # root layout (mínimo)
  page.tsx            # landing simples
emails/
  WaitlistJoined.tsx  # React Email template (PT-BR)
lib/
  db/
    client.ts         # Neon client (cached)
    schema.ts         # tabela sent_emails
  dedupe.ts           # chave de idempotência
  hmac.ts             # sign + verify
  log.ts              # JSON estruturado
  resend.ts           # wrapper Resend
drizzle.config.ts
```

## Pré-requisitos de produção

1. **DKIM/SPF/DMARC** em `useteller.com.br` na Resend (sem isso, deliverability vai pro lixo)
2. **Reply-to** (`oi@useteller.com.br`) precisa existir e ter alguém lendo
3. **Plugar form externo** (Tally/landing) no endpoint — tarefa separada
