# ORIGOCRM

CRM de prospeccao via WhatsApp feito com Next.js, Supabase Auth/Postgres e Evolution API.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000`.

Sem Supabase configurado, a app abre em modo demo local. Com Supabase configurado, o login usa magic link e os dados ficam protegidos por RLS.

## Banco de dados Supabase

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Rode o conteudo de `supabase/schema.sql`.
4. Em `Authentication > URL Configuration`, configure:
   - Site URL local: `http://localhost:3000`
   - Site URL em producao: sua URL da Vercel
   - Redirect URLs: `http://localhost:3000/**` e `https://seu-dominio.vercel.app/**`

## Variaveis de ambiente

Obrigatorias para Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
APP_URL=
```

A lista completa (Stripe, Google Agenda, SerpAPI) está em `.env.example`.

Opcionais para WhatsApp/Evolution:

```bash
NEXT_PUBLIC_EVOLUTION_ENABLED=true
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_WEBHOOK_KEY=
```

Para subir uma Evolution API propria (Docker + HTTPS), siga `deploy/evolution/README.md`.

Nao use `NEXT_PUBLIC_` em chaves privadas da Evolution. Elas rodam apenas no servidor.

## Deploy na Vercel

1. Importe o repositorio na Vercel como projeto Next.js.
2. Cadastre as variaveis acima em `Project Settings > Environment Variables`.
3. Configure `NEXT_PUBLIC_APP_URL` com a URL final da Vercel.
4. Rode o build:

```bash
npm run build
```

O webhook da Evolution deve apontar para:

```text
https://seu-dominio.vercel.app/api/webhooks/evolution
```

Envie a chave definida em `EVOLUTION_WEBHOOK_KEY` no header `x-evolution-signature` ou `Authorization: Bearer <chave>`. Quando a instância é criada pela própria app (com `APP_URL` definido), o webhook já é registrado com esse header. Ainda é aceito `?token=<chave>` na URL por compatibilidade, mas evite: a URL aparece em logs.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run start
```

O GitHub Actions roda lint, checagem de tipos e testes em todo push e pull request (`.github/workflows/ci.yml`).
