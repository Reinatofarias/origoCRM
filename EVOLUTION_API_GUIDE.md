# 🚀 Guia de Integração Evolution API (WhatsApp)

## 📋 Visão Geral

A Evolution API é uma plataforma que permite integrar WhatsApp em aplicações sem usar a API oficial do WhatsApp Business. Ela funciona como um intermediário que gerencia as instâncias do WhatsApp Web.

### O que foi implementado

✅ **Types TypeScript** - Interface completa com `EvolutionMessageType`, `EvolutionWebhookPayload`, etc.
✅ **Server Actions** - `sendWhatsAppMessage`, `logWhatsAppEvent`, `updateMessageStatus`
✅ **Webhook Handler** - Receber eventos em tempo real (`/api/webhooks/evolution`)
✅ **Utilitários** - Funções helpers para validação e formatação
✅ **Documentação .env** - Variáveis necessárias documentadas

---

## 🔧 Como Configurar

### 1. Obter Credenciais da Evolution API

Visite [Evolution API](https://www.evolution.one/) e:

1. Crie uma conta
2. Crie uma nova instância
3. Copie:
   - **API URL**: URL base da sua instância
   - **API Key**: Chave para autenticação
   - **Instance Name**: Nome da instância

### 2. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha com suas credenciais:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=sua-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave

# Evolution API
NEXT_PUBLIC_EVOLUTION_ENABLED=true
EVOLUTION_API_URL=https://seu-evolution.com.br/api
EVOLUTION_API_KEY=sua-api-key
EVOLUTION_INSTANCE_NAME=origo-crm
EVOLUTION_WEBHOOK_KEY=sua-chave-webhook-segura
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Configurar Webhook na Evolution

Na dashboard da Evolution:

1. Acesse **Webhook Settings**
2. Configure a URL:
   ```
   https://seu-dominio.com/api/webhooks/evolution
   ```
3. Configure os eventos que deseja receber:
   - `messages.upsert` - Nova mensagem
   - `messages.update` - Atualização de status
   - `connection.update` - Status da conexão
4. Salve a chave webhook gerada

### 4. Em Desenvolvimento (Local)

Para testar localmente com webhooks, use **ngrok**:

```bash
# Instale ngrok
npm install -g ngrok

# Expor porta local
ngrok http 3000

# Copie a URL gerada (exemplo: https://abc123.ngrok.io)
```

Configure no `.env.local`:

```env
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
EVOLUTION_WEBHOOK_KEY=sua-chave-webhook-segura
```

---

## 📚 Estrutura de Arquivos

### Types
```
src/lib/types.ts
├── EvolutionMessageType
├── EvolutionMessageStatus
├── EvolutionSendTextRequest
├── EvolutionSendTextResponse
├── EvolutionWebhookPayload
├── EvolutionIncomingMessage
├── EvolutionMessageUpdate
└── WhatsAppMessage
```

### Server Actions
```
src/actions/whatsapp.ts
├── sendWhatsAppMessage()        - Enviar texto
├── getWhatsAppHistory()         - Buscar histórico
├── logWhatsAppEvent()           - Registrar evento
├── updateMessageStatus()        - Atualizar status
└── validateEvolutionWebhook()   - Validar assinatura
```

### Services
```
src/lib/services/whatsapp.ts
├── openWhatsAppLink()           - Link direto
├── isEvolutionConfigured()      - Verificar config
├── getEvolutionConfig()         - Obter config
├── getEvolutionWebhookUrl()     - URL webhook
├── validateEvolutionSetup()     - Validar setup
├── checkEvolutionInstance()     - Verificar conexão
└── formatPhoneForWhatsApp()     - Formatar phone
```

### API Routes
```
src/app/api/webhooks/evolution/route.ts
├── POST handler                 - Receber webhooks
├── GET handler                  - Status do webhook
└── Event handlers:
    ├── handleMessageUpsert()
    ├── handleMessageUpdate()
    ├── handleConnectionUpdate()
    └── ...
```

---

## 📲 Como Usar

### 1. Enviar Mensagem via Server Action

```typescript
import { sendWhatsAppMessage } from "@/actions/whatsapp";

// No seu componente/função
const result = await sendWhatsAppMessage(
  leadId,
  "5585999990001",  // Phone number
  "Olá! Como vai?" // Message
);

if (result.success) {
  console.log("Mensagem enviada:", result.messageId);
} else {
  console.error("Erro:", result.error);
}
```

### 2. Abrir WhatsApp Direto (Link)

```typescript
import { openWhatsAppLink } from "@/lib/services/whatsapp";

// Sem precisar da Evolution API configurada
// Apenas abre o WhatsApp Web ou app
openWhatsAppLink("5585999990001", "Olá! Como vai?");
```

### 3. Verificar Configuração

```typescript
import { validateEvolutionSetup } from "@/lib/services/whatsapp";

const { valid, errors } = validateEvolutionSetup();

if (!valid) {
  console.error("Problemas na configuração:", errors);
}
```

### 4. Formatar Número

```typescript
import { formatPhoneForWhatsApp } from "@/lib/services/whatsapp";

const phone = formatPhoneForWhatsApp("85 9999-0001");
// Retorna: "5585999990001"
```

---

## 🔄 Fluxo de Mensagens

### Envio (Outbound)

```
UI → sendWhatsAppMessage() 
  → callEvolutionApi("/message/sendText")
  → Evolution API
  → WhatsApp Server
  → Lead recebe mensagem
```

### Recebimento (Inbound)

```
Lead envia mensagem
  → WhatsApp Server
  → Evolution API
  → POST /api/webhooks/evolution
  → handleMessageUpsert()
  → Salvar no banco
  → Atualizar lead status
  → Criar interação
```

### Status de Entrega

```
WhatsApp atualiza status
  → Evolution API
  → POST /api/webhooks/evolution (messages.update)
  → updateMessageStatus()
  → Atualizar status no banco
```

---

## 📊 Estrutura de Dados

### Mensagem Enviada

```typescript
// Request
{
  number: "5585999990001",
  text: "Olá! Como vai?"
}

// Response
{
  id: "3EB0C75D0FFBECF7B96D9E9B9B9B9B9B",
  number: "5585999990001",
  status: "sent",
  timestamp: 1704067200000
}
```

### Webhook Recebido

```typescript
// Event: messages.upsert
{
  event: "messages.upsert",
  data: {
    key: {
      remoteJid: "5585999990001@s.whatsapp.net",
      id: "3EB0C75D0FFBECF7B96D9E9B9B9B9B9B",
      fromMe: false
    },
    message: {
      conversation: "Oi! Tudo bem com você?"
    },
    messageTimestamp: 1704067200000,
    pushName: "Marina",
    status: "received"
  }
}
```

---

## ⚠️ Tratamento de Erros

### Erros Comuns

| Erro | Solução |
|------|---------|
| `Evolution API não configurada` | Verificar variáveis de ambiente |
| `Erro 401: Invalid API Key` | Chave de API incorreta |
| `Erro 404: Instance not found` | Nome da instância errado |
| `Webhook não recebendo` | Verificar URL pública e firewall |
| `Mensagem muito longa` | Limite é 1024 caracteres |

### Logs

O webhook registra todos os eventos em `WhatsApp Logs`:

```typescript
// Acessar logs
SELECT * FROM whatsapp_logs ORDER BY created_at DESC LIMIT 100;
```

---

## 🧪 Testar Localmente

### 1. Iniciar servidor

```bash
npm run dev
```

### 2. Verificar webhook

```bash
# Testar se o endpoint está acessível
curl http://localhost:3000/api/webhooks/evolution

# Deve retornar:
# {
#   "status": "ok",
#   "webhook": "/api/webhooks/evolution",
#   "events": [...]
# }
```

### 3. Simular webhook

```bash
# Enviar um webhook de teste
curl -X POST http://localhost:3000/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -H "x-evolution-signature: test-signature" \
  -d '{
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "5585999990001@s.whatsapp.net",
        "id": "test-123",
        "fromMe": false
      },
      "message": {
        "conversation": "Teste de mensagem"
      }
    }
  }'
```

---

## 🚀 Próximas Etapas

- [ ] Implementar persistência no banco (WhatsApp Messages table)
- [ ] Criar hook `useWhatsApp()` para reatividade
- [ ] Adicionar re-tentativa automática em caso de falha
- [ ] Implementar rate limiting
- [ ] Adicionar suporte a múltiplas mídias
- [ ] Dashboard de logs de WhatsApp

---

## 📖 Recursos

- [Evolution API Docs](https://www.evolution.one/)
- [WhatsApp API Specs](https://developers.facebook.com/docs/whatsapp)
- [ngrok Documentation](https://ngrok.com/docs)
- [Supabase JavaScript](https://supabase.com/docs/reference/javascript)
