# 📁 Estrutura de Pastas - OrigoCRM

Guia completo sobre a organização do projeto reorganizado.

## 🎯 Princípios

- **Separação de Responsabilidades**: Cada pasta tem um propósito específico
- **Escalabilidade**: Fácil adicionar novos features sem quebrar a arquitetura
- **Manutenibilidade**: Código organizado e fácil de encontrar
- **Type Safety**: TypeScript em toda a aplicação

---

## 📂 Estrutura Detalhada

```
src/
├── app/                                  # App Router do Next.js 14+
│   ├── (auth)/                          # Route Group para autenticação
│   │   ├── login/
│   │   ├── signup/
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                     # Route Group para rotas protegidas
│   │   ├── dashboard/                   # Dashboard com KPIs
│   │   │   └── page.tsx
│   │   ├── pipeline/                    # Pipeline Kanban
│   │   │   └── page.tsx
│   │   ├── leads/                       # Listagem e detalhes de leads
│   │   │   ├── page.tsx
│   │   │   └── [id]/detail.tsx
│   │   ├── interactions/                # Histórico de interações
│   │   │   └── page.tsx
│   │   ├── templates/                   # Gestão de templates
│   │   │   └── page.tsx
│   │   ├── reports/                     # Relatórios e analytics
│   │   │   └── page.tsx
│   │   ├── settings/                    # Configurações do usuário
│   │   │   └── page.tsx
│   │   └── layout.tsx                   # Layout protegido
│   │
│   ├── api/                             # API Routes
│   │   ├── webhooks/
│   │   │   └── evolution/route.ts       # Webhook para mensagens WhatsApp
│   │   ├── leads/
│   │   │   ├── route.ts                 # CRUD de leads
│   │   │   └── [id]/route.ts
│   │   └── interactions/
│   │       └── route.ts                 # CRUD de interações
│   │
│   ├── layout.tsx                       # Layout root
│   ├── page.tsx                         # Página inicial/home
│   └── globals.css                      # Estilos globais
│
├── components/                          # Componentes React reutilizáveis
│   ├── ui/                              # Componentes básicos (agora com shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── modal.tsx
│   │   └── ...
│   │
│   ├── layout/                          # Componentes de layout
│   │   ├── Sidebar.tsx                  # Navegação lateral
│   │   ├── Header.tsx                   # Header superior
│   │   └── index.ts
│   │
│   ├── leads/                           # Componentes relacionados a leads
│   │   ├── LeadCard.tsx                 # Card para exibir lead
│   │   ├── LeadForm.tsx                 # Formulário de criação/edição
│   │   ├── LeadList.tsx                 # Listagem de leads
│   │   └── index.ts
│   │
│   ├── interactions/                    # Componentes de interações
│   │   ├── InteractionTimeline.tsx      # Timeline visual
│   │   ├── InteractionForm.tsx          # Adicionar nota/interação
│   │   └── index.ts
│   │
│   ├── templates/                       # Componentes de templates
│   │   ├── TemplateSelector.tsx         # Seletor com preview
│   │   ├── TemplateForm.tsx             # Criar/editar template
│   │   └── index.ts
│   │
│   ├── dashboard/                       # Componentes do dashboard
│   │   ├── KPICard.tsx                  # Cards de métrica
│   │   ├── PriorityList.tsx             # Lista de prioridades
│   │   ├── ConversionFunnel.tsx         # Gráfico do funil
│   │   └── index.ts
│   │
│   ├── whatsapp/                        # Componentes WhatsApp
│   │   ├── WhatsAppButton.tsx           # Botão enviar
│   │   ├── MessagePreview.tsx           # Preview da mensagem
│   │   └── index.ts
│   │
│   └── common/                          # Componentes genéricos
│       ├── Toast.tsx                    # Notificações
│       ├── Loading.tsx                  # Spinner de carregamento
│       └── index.ts
│
├── lib/                                 # Lógica reutilizável
│   ├── types.ts                         # Definições de tipos TypeScript
│   ├── config.ts                        # Configurações globais
│   ├── supabase.ts                      # Cliente Supabase (legado)
│   │
│   ├── constants/                       # Constantes da aplicação
│   │   ├── defaults.ts                  # Dados de demo
│   │   └── index.ts
│   │
│   ├── hooks/                           # Custom React Hooks
│   │   ├── useLocalState.ts             # Estado com localStorage
│   │   ├── useLeads.ts                  # Hook para gerenciar leads
│   │   ├── useInteractions.ts           # Hook para interações
│   │   └── index.ts
│   │
│   ├── services/                        # Serviços (lógica de negócio)
│   │   ├── leads.ts                     # Operações com leads
│   │   ├── whatsapp.ts                  # Integração WhatsApp/Evolution
│   │   ├── reports.ts                   # Cálculos de relatórios
│   │   └── index.ts
│   │
│   ├── utils/                           # Funções utilitárias
│   │   ├── formatting.ts                # Format, parse, transformações
│   │   ├── validation.ts                # Validações (Zod)
│   │   └── index.ts
│   │
│   └── db/                              # Queries Supabase
│       ├── queries.ts                   # Queries otimizadas
│       └── index.ts
│
├── actions/                             # Server Actions (Next.js 13+)
│   ├── leads.ts                         # CRUD de leads
│   ├── interactions.ts                  # Criar interações
│   ├── templates.ts                     # CRUD de templates
│   ├── whatsapp.ts                      # Enviar mensagens
│   ├── reports.ts                       # Gerar relatórios
│   └── index.ts
│
├── proxy.ts                             # Proxy do Next.js
└── config.ts                            # Configurações globais
```

---

## 🔑 Convenções de Código

### Imports

```typescript
// ✅ Prefira imports absolutos
import { useLeads } from "@/lib/hooks";
import { LeadCard } from "@/components/leads";

// ❌ Evite imports relativos
import { useLeads } from "../../../lib/hooks";
```

### Types

```typescript
// ✅ Mantenha types no lib/types.ts
export type Lead = { ... };

// ❌ Evite types espalhados
// Em cada arquivo, faça: import type { Lead } from "@/lib/types";
```

### Componentes

```typescript
// ✅ Componente bem organizado
export function LeadCard({ lead, onEdit }: Props) {
  return <div>...</div>;
}

// ✅ Re-exports em index.ts
// Em components/leads/index.ts:
export { LeadCard } from "./LeadCard";
```

### Server Actions

```typescript
// ✅ "use server" no topo
"use server";

export async function createLead(input: LeadInput) {
  // Lógica servidor
}
```

---

## 📊 Fluxo de Dados

```
UI Component
    ↓
Server Action / useHook
    ↓
Service (leads.ts, whatsapp.ts)
    ↓
Supabase Query (db/)
    ↓
Database
```

Exemplo prático:

```typescript
// 1. Componente chama ação
<button onClick={() => updateLeadStatus(leadId, "contatado")}>
  Marcar Contatado
</button>

// 2. Server Action (actions/leads.ts)
export async function updateLeadStatus(id: string, status: LeadStatus) {
  const result = await leadsQueries.update(id, { status });
  revalidatePath("/dashboard/pipeline");
  return result;
}

// 3. Service trata lógica (lib/services/leads.ts)
export function makeInteraction(leadId, note, type) {
  return { id, lead_id: leadId, note, type, ... };
}

// 4. Database query (lib/db/queries.ts)
export const leadsQueries = {
  update: async (id, updates) => {
    return supabase.from("leads").update(updates).eq("id", id);
  }
}
```

---

## 🚀 Próximas Etapas

### Fase 1: MVP (Semanas 1-8)
- [ ] Mover componentes do crm-app.tsx para respectivas pastas
- [ ] Criar hooks customizados (useLeads, useInteractions)
- [ ] Implementar PWA e offline-first
- [ ] Setup Evolution API

### Fase 2: Automações (Semanas 9-10)
- [ ] Auto-agendamento follow-ups
- [ ] Notificações push
- [ ] Alertas de leads frios

### Fase 3: Analytics (Semanas 11-12)
- [ ] Dashboard com gráficos
- [ ] Relatórios exportáveis
- [ ] Métricas de conversão

---

## 📝 Checklist para Novos Features

Ao adicionar um novo feature, siga:

- [ ] Criar tipos em `lib/types.ts`
- [ ] Criar componentes em `components/[feature]/`
- [ ] Criar queries em `lib/db/queries.ts`
- [ ] Criar service em `lib/services/[feature].ts`
- [ ] Criar Server Actions em `actions/[feature].ts`
- [ ] Criar página em `app/(dashboard)/[feature]/page.tsx`
- [ ] Adicionar testes (se aplicável)
- [ ] Atualizar documentação

---

## 🔗 Recursos

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase JavaScript](https://supabase.com/docs/reference/javascript)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/)
