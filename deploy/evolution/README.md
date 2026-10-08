# Evolution API própria

Este guia sobe a Evolution API v2 (WhatsApp) num servidor seu, com HTTPS automático, e liga o OrigoCRM a ela.

## O que você precisa

- Um servidor Linux (VPS) com Ubuntu 22.04 ou 24.04, **2 GB de RAM** ou mais e IP público. Qualquer provedor serve (Hetzner, Contabo, Hostinger, DigitalOcean etc.).
- Um subdomínio, por exemplo `evolution.seudominio.com.br`, com um registro **A** apontando para o IP do servidor.
- As portas 80 e 443 liberadas no firewall do provedor. O Caddy usa essas portas para gerar o certificado HTTPS.

## 1. Instalar o Docker no servidor

```bash
ssh root@IP_DO_SERVIDOR
curl -fsSL https://get.docker.com | sh
```

## 2. Copiar os arquivos e configurar

No servidor:

```bash
git clone https://github.com/Reinatofarias/origoCRM.git
cd origoCRM/deploy/evolution
cp .env.example .env
openssl rand -hex 32   # use como AUTHENTICATION_API_KEY
openssl rand -hex 24   # use como POSTGRES_PASSWORD
nano .env
```

Preencha `EVOLUTION_DOMAIN`, `AUTHENTICATION_API_KEY` e `POSTGRES_PASSWORD`. Guarde a `AUTHENTICATION_API_KEY`: ela vai para a Vercel no passo 4.

## 3. Subir

```bash
docker compose up -d
docker compose logs -f evolution   # Ctrl+C para sair
```

Para testar, abra `https://SEU_SUBDOMINIO` no navegador. A Evolution deve responder com um JSON contendo `"status": 200`. Se der erro de certificado, confira se o DNS já aponta para o servidor (`ping SEU_SUBDOMINIO`) e veja `docker compose logs caddy`.

## 4. Ligar o OrigoCRM

Na Vercel, em **Project Settings > Environment Variables**, defina:

| Variável | Valor |
| --- | --- |
| `EVOLUTION_API_URL` | `https://SEU_SUBDOMINIO` |
| `EVOLUTION_API_KEY` | a `AUTHENTICATION_API_KEY` do `.env` do servidor |
| `EVOLUTION_WEBHOOK_KEY` | uma chave nova (`openssl rand -hex 32`); é diferente da anterior |
| `APP_URL` | a URL de produção do OrigoCRM, ex.: `https://origocrm.vercel.app` |
| `NEXT_PUBLIC_EVOLUTION_ENABLED` | `true` |

Depois, faça um **Redeploy**.

## 5. Reconectar os números

As instâncias antigas ficaram no servidor que você não acessa mais, então cada empresa precisa ler o QR Code de novo. Ao abrir a tela de WhatsApp, o OrigoCRM percebe que a instância não existe no servidor novo. Ele cria a instância e registra o webhook (com a `EVOLUTION_WEBHOOK_KEY` no header) sozinho. Depois, é só gerar o QR Code e escanear pelo celular.

## Manutenção

- Atualizar a Evolution: troque a versão da imagem em `docker-compose.yml` e rode `docker compose pull && docker compose up -d`.
- Backup: as sessões do WhatsApp ficam nos volumes `evolution_instances` e `postgres_data`. Se perder esses volumes, todos os números precisam ler o QR Code de novo.
- Nunca exponha a porta 8080 diretamente. O acesso passa só pelo Caddy, em HTTPS.
