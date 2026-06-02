# Próximos passos — teller-waitlist-email

> Snapshot de retomada. Apaga este arquivo quando todos os passos abaixo estiverem ✅.
>
> Spec: [`teller-brain/initiatives/specs/teller-waitlist-email.md`](../teller-brain/initiatives/specs/teller-waitlist-email.md)
> Commit atual: `ddf1e1f` — scaffold inicial + endpoint + 18 testes verdes

---

## Estado atual

- ✅ Spec aprovada
- ✅ Repo scaffold (Next.js 15 + TS + Tailwind + Drizzle/Neon + Resend + React Email + vitest)
- ✅ Endpoint `POST /api/waitlist/joined` com HMAC + dedupe + logs estruturados
- ✅ 18/18 testes verdes (`npm test`)
- ✅ Push em `github.com/filipepedra/teller-waitlist-email`

## Bloqueadores externos pendentes

- [ ] Conta **Neon** ([neon.tech](https://neon.tech)) — login Google/GitHub
- [ ] Conta **Resend** ([resend.com](https://resend.com))
- [ ] DKIM/SPF/DMARC em `useteller.com.br` nos DNS do registrador
- [ ] Confirmar se `oi@useteller.com.br` existe (se não → trocar reply-to pra `edu@`)
- [ ] Conta **Vercel** ([vercel.com](https://vercel.com)) — provavelmente já tem

## Sequência de retomada

### 1. Neon (DB) → eu rodo

Depois que você criar conta Neon e me avisar:

```sh
neonctl auth                           # abre browser pra autenticar
neonctl projects create --name teller-waitlist-email
neonctl connection-string ...          # capturo DATABASE_URL
```

Daí monto `.env` local e rodo:

```sh
cd C:\Users\filip\github\teller-waitlist-email
npm run db:push                        # cria tabela sent_emails
```

### 2. Resend → eu rodo após conta criada e domínio verificado

- Você adiciona domínio `useteller.com.br` em Resend dashboard
- Resend mostra os DNS records (DKIM, SPF, DMARC) pra adicionar no seu registrador
- Você espera propagação (~minutos) e clica "Verify" no dashboard
- Você gera API key + cola aqui pra eu adicionar no `.env`

### 3. HMAC secret → eu gero

```sh
openssl rand -hex 32                   # gera 64 chars
```

Vai no `.env` local e nas envs da Vercel.

### 4. Smoke test local → eu rodo

```sh
npm run dev                            # localhost:3000
# em outro terminal, curl com HMAC válido (README tem o snippet)
```

Valida: endpoint responde, HMAC verifica, DB grava, Resend envia (pra você mesmo, sandbox).

### 5. Deploy Vercel → nós dois

- Você conecta o repo na Vercel (web UI, primeiro deploy)
- Eu configuro env vars via CLI ou você cola na UI:
  - `DATABASE_URL`
  - `RESEND_API_KEY`
  - `WAITLIST_EMAIL_HMAC_SECRET`
  - `WAITLIST_EMAIL_FROM=Teller <no-reply@useteller.com.br>`
  - `WAITLIST_EMAIL_REPLY_TO=oi@useteller.com.br` (ou `edu@`)
- Smoke test em produção: curl pro endpoint público, email real chega no seu inbox

### 6. Plugar form externo → você (depois)

Tarefa fora deste repo. Issue follow-up em `teller-brain`. Depende de identificar onde a waitlist captura hoje (Tally/landing/etc) e configurar webhook → nosso endpoint com assinatura HMAC.

## Convenções daqui pra frente

- **PR workflow**: cada mudança nova sai em branch `feat/<x>` e abre PR contra `main`
- **Commits pequenos**: 1 commit por unidade lógica (ex: "feat: db migration", "fix: validação de email"), não bundle de várias coisas
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`

## Comandos úteis

```sh
npm test                  # roda testes 1x
npm run test:watch        # watch
npm run typecheck         # tsc --noEmit
npm run dev               # dev server
npm run db:generate       # gera migration a partir do schema
npm run db:push           # aplica schema no DB
```
