# PERMIT SCANNER — Manual do Reginaldo

> Reginaldo + Michel, esse documento tem TUDO que vocês precisam saber pra usar e gerenciar o sistema. Guarda ele.
>
> Entregue por: Me Ensina AI (Fábio + Carlos AI) — 04/maio/2026

---

## 🚀 SEUS LINKS

| O que | Link | Pra que serve |
|---|---|---|
| **App de permits** | https://permit-scanner.vercel.app | É aqui que vocês acessam todos os dias pra ver leads novos |
| **Banco de dados** | https://supabase.com/dashboard/project/phfziueyhyjrzreomhgp | Painel Supabase. Onde os dados ficam guardados. Não mexer sem precisar |
| **Código fonte** | https://github.com/ConnectionShieldGroup/permit-scanner | GitHub. Time técnico atualiza daqui |
| **Hospedagem** | https://vercel.com/connectionshield-reg/permit-scanner | Vercel. App roda aqui. Não mexer sem precisar |

---

## ✅ O QUE TÁ FUNCIONANDO HOJE

**1.265 permits residenciais reais** das 9 cidades de Massachusetts, totalizando **~$95 milhões em obras ativas**:

| Cidade | Permits | Plataforma fonte |
|---|---|---|
| Somerville | 306 | Open Data oficial da prefeitura |
| Hingham | 209 | Portal PermitEyes da cidade |
| Randolph | 201 | Portal PermitEyes da cidade |
| Braintree | 164 | Portal PermitEyes da cidade |
| Lexington | 158 | Relatório mensal da prefeitura |
| Wakefield | 107 | Relatório mensal da prefeitura |
| North Reading | 71 | Portal PermitEyes da cidade |
| Reading | 42 | Relatório mensal da prefeitura |
| Hanson | 19 | Portal PermitEyes da cidade |

Todos os permits são **públicos por lei** (Massachusetts Public Records Law c.66). Não há nada ilegal ou cinzento aqui.

---

## 🎯 COMO USAR DIA A DIA

### Página principal (`/`) — Lista de permits

Cada card mostra:
- Endereço
- Categoria (New Construction, Bath Renovation, Kitchen Renovation, Addition, Renovation, Building Permit, Foundation Permit)
- Data emissão do permit
- Applicant (quem pediu)
- Valor estimado da obra (quando disponível)

**Clica em qualquer card** → abre Dialog grande com:
- Descrição completa da obra
- Telefone (quando disponível)
- Email (quando disponível)
- Owner (proprietário)
- Map/Block/Lot
- Zoning
- Status

### Filtrando

Topo da página tem 4 filtros:
- **Search address** — busca por rua, ex: "Maple Street"
- **City** — escolhe 1 das 9 cidades ou "All cities"
- **Month** — filtra por mês de emissão
- **Work type** — filtra por categoria

### Adicionando ao Pipeline

Em cada card, click em **"+ Add to pipeline"** → vai pra coluna "Permits encontrados" no Pipeline Kanban.

### Pipeline Kanban (`/kanban`)

6 colunas que vocês arrastam o card conforme avança a venda:

1. **Permits encontrados** (recém-coletados)
2. **Visitados** (foi até a obra)
3. **Apresentação enviada** (mandou material da empresa)
4. **Proposta enviada** (orçamento formal)
5. **Cliente** ← arrasta aqui = vai automático pro board "Clientes Ativos"
6. **Não fechado** ← arrasta aqui = vai pro board "Não Efetivados"

**Não precisa salvar — drag-and-drop salva automático.**

### Criando rota de visitas no Google Maps

1. Na página principal, **marca os checkboxes** "Select for route" nos permits que quer visitar (5-10 idealmente)
2. Click no botão **"Build route"** (canto inferior direito)
3. Abre o Google Maps já com todos os endereços como paradas
4. Otimiza ordem da rota e segue a viagem

---

## 🔄 COMO O SISTEMA SE ATUALIZA

### Atualização automática (futura — V2)

Sistema vai rodar um cron quinzenal — **dia 1 e dia 16 de cada mês, às 11h NY** — que vai puxar os permits novos das cidades automaticamente.

**Por enquanto (V1):** o sistema tá com snapshot do dia 03/maio/2026. Pra atualizar manualmente, fala com a Me Ensina AI que a gente roda o pipeline.

### Atualização manual (suporte Me Ensina)

Se quiser dados mais frescos antes do próximo cron rodar, manda um WhatsApp pra Fábio. Em ~10 min a gente roda o pipeline e atualiza.

---

## 📊 BANCO DE DADOS SUPABASE

Vocês têm acesso completo ao banco. Pra olhar dados crus:

1. Entra em https://supabase.com/dashboard/project/phfziueyhyjrzreomhgp
2. Menu lateral → **Table Editor** → tabela `permits`
3. Aí vê os 1.265 permits em formato planilha

### Tabelas importantes

| Tabela | O que guarda |
|---|---|
| `permits` | Os 1.265 permits coletados |
| `kanban_cards` | Os cards do pipeline (qual permit tá em qual coluna) |
| `cities_config` | As 29 cidades MA. Marca quais estão "ativas" pra coleta |
| `app_config` | Configurações do sistema (chaves do cron, etc) |

### Pra rodar uma busca SQL

Menu → **SQL Editor** → "+ New query" → cola algo tipo:

```sql
-- Permits acima de $50.000 nos últimos 30 dias
SELECT permit_number, city, address, applicant_name,
       estimated_value, work_type, description
FROM permits
WHERE estimated_value > 50000
  AND permit_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY estimated_value DESC;
```

### Top 10 mais caros

```sql
SELECT city, address, applicant_name, estimated_value, description
FROM permits
ORDER BY estimated_value DESC NULLS LAST
LIMIT 10;
```

### Permits de janelas/portas/siding

```sql
SELECT city, address, applicant_name, estimated_value, description
FROM permits
WHERE description ILIKE '%window%'
   OR description ILIKE '%door%'
   OR description ILIKE '%siding%'
   OR description ILIKE '%glass%'
ORDER BY permit_date DESC
LIMIT 50;
```

---

## ⚠️ LIMITAÇÕES CONHECIDAS V1

### 1. Apenas 9 das 30 cidades estão cobertas

**As 9 que estão funcionando:** Hingham, Somerville, Randolph, Braintree, Lexington, Wakefield, North Reading, Reading, Hanson.

**Por quê só 9?** As outras 21 cidades publicam dados em formatos que precisam de mais trabalho técnico (login, Cloudflare, FOIA). Vamos cobrindo aos poucos — V2 e V3.

### 2. Telefone/email nem sempre vem preenchido

**Tem mais nessas:** Hingham (90%+), Somerville (alguns), Wakefield (parcial).
**Tem menos nessas:** Lexington, Reading (só nome do applicant).

V2 vai enriquecer via Apollo.io ou Hunter quando faltar (custo extra ~$50/mês mas dobra qualidade do lead).

### 3. Valor da obra vem só em algumas cidades

Hingham 96%, Wakefield 100%, Lexington 95%, Somerville 80%, Reading 100%, outras menos.

### 4. Atualização não é em tempo real

Cron quinzenal (dia 1 e 16 de cada mês). Pra atualizações intermediárias, manual via Me Ensina.

### 5. Algumas cidades publicam com 1-3 meses de delay

Reading e Wakefield publicam relatórios mensais com 1-3 meses de atraso. Lexington 1 mês. Somerville/PermitEyes em tempo real.

---

## 🛡️ TCPA E LEIS — CUIDADOS LEGAIS

Esse sistema entrega dados públicos por lei. Isso NÃO quer dizer que vocês podem fazer qualquer coisa com os contatos. Algumas regras importantes:

### Cold call manual = OK
Ligar pro telefone do applicant pra oferecer serviço é permitido (uso comercial legítimo de dado público).

### SMS automatizado / robocall = CUIDADO
Lei TCPA (Telephone Consumer Protection Act) federal proíbe SMS marketing automatizado sem consentimento prévio. Multas chegam a $500-1.500 por mensagem. **Não use o sistema pra disparar SMS em massa.**

### Email cold = geralmente OK
Lei CAN-SPAM permite email comercial pra contatos públicos, desde que: tenha link de unsubscribe, identifique remetente, e não tenha "intent to deceive". Mas evite spam óbvio.

### Visita pessoal porta-a-porta
Permitido sem registro, exceto algumas cidades MA que exigem "solicitor permit" (~$50, registra na prefeitura). Verifique com cada cidade.

**Em caso de dúvida — consulta um advogado local.**

---

## 🚀 ROADMAP — O QUE VEM PELA FRENTE

### V2 (1-2 semanas)
- **Mais 5-10 cidades** cobertas (Norwell, Bedford, Whitman, Scituate, Marshfield via login que vocês criam — gratuito)
- **Cron automatizado** quinzenal (dia 1 e 16, 11h NY)
- **Notificação Telegram/email** quando aparece permit acima de $X
- **Enriquecimento de telefone/email** via Apollo (opcional, +$50/mês)

### V3 (3-4 semanas)
- **Cidades restantes** via Browserless ($10/mês — paga sistema, vocês não tocam)
- **Boston + Cambridge** (mais 700.000+ permits adicionais como bonus)
- **Mapa interativo** (ver permits no mapa, não só lista)
- **Dashboard de métricas** (quantos viraram cliente, conversão por cidade, ticket médio)

### V4 (futuro)
- **Integração com WhatsApp** (recebe notificação direto no celular)
- **AI scoring** (sistema prevê quais permits têm maior chance de virar venda)
- **Compartilhamento de leads** entre vendedores do time

---

## 📞 SUPORTE

### Coisas pequenas (filtro não funciona, dado errado, sugestão)
WhatsApp pro Fábio. Resolve em horas.

### Adicionar cidade nova
Manda lista de cidades pro Fábio — dependendo da plataforma da cidade, pode ser ativação imediata (5 min) ou semana de trabalho técnico.

### Bug crítico (sistema fora do ar)
WhatsApp Fábio. Investigamos imediato. Sistema redundante (Vercel + Supabase free tier) raramente cai.

### Quero exportar dados
Supabase Dashboard → Table Editor → permits → "Export to CSV" no canto.

---

## 🔐 SEGURANÇA — IMPORTANTE

### Senhas que vocês criaram
- **Supabase database password:** vocês definiram. Anotem em local seguro (1Password, etc)
- **GitHub:** conta Reginaldo (ou da org ConnectionShieldGroup)
- **Vercel:** logado via GitHub

### O que NUNCA compartilhar
- **Service role key** do Supabase (chave admin, dá controle total do banco)
- **Senha do banco**

### O que pode compartilhar com time
- URL do app (https://permit-scanner.vercel.app)
- Acesso ao Supabase Dashboard como **viewer** (não editor)

### Habilitar 2FA (recomendado)
GitHub e Supabase oferecem 2FA. Liguem ambos. 5 min de setup, zero risco depois.

---

## 💡 IDEIAS DE USO

### Use 1 — Prospecção semanal
Toda segunda de manhã, 30 min:
1. Abre o app
2. Filtra cidade + última semana
3. Vai pra cards de Bath Renovation, Kitchen, New Construction, Addition (esses são os que mais precisam de proteção/vidraçaria)
4. Adiciona 10-15 ao pipeline
5. Cria rota Google Maps pros 5 mais próximos
6. Visita na quarta-feira

### Use 2 — Cold call em loja
Na hora ociosa da loja:
1. Abre o app
2. Filtra Lexington (cidade rica, ticket alto)
3. Pega permits com valor >$100k
4. Liga pro applicant: "Olá, vi que você tá fazendo obra em [endereço]. Sou da Connection Glass, fazemos vidraçaria/proteção. Tem 5 minutos?"
5. Marca consulta presencial

### Use 3 — Trade com outros contractors
Você atende vidraçaria. Tem permit que precisa de roofer ou electrician?
1. Cria parceria com 2-3 contractors complementares
2. Quando vê permit perfeito pra eles no app, manda screenshot
3. Pede em troca leads de vidraçaria que aparecem nas cidades deles
4. Compartilha custos do sistema (em breve a gente abre versão multi-tenant)

### Use 4 — Análise de mercado
Mensalmente:
1. Conta total de permits de Bath Renovation por cidade (Supabase SQL)
2. Compara mês a mês
3. Identifica cidades em crescimento (anuncia mais marketing lá)
4. Identifica cidades em queda (reavalia esforço)

---

## 🎓 INVESTIMENTO MENSAL DO SISTEMA

Pra vocês saberem o que tem por baixo:

| Item | Custo |
|---|---|
| Supabase (banco) | $0 (free tier — 500MB, suficiente pra 100k+ permits) |
| Vercel (hospedagem app) | $0 (Hobby plan free) |
| Domínio personalizado (opcional) | ~$10/ano (se quiserem `permits.connectionshield.com` em vez de `.vercel.app`) |
| Browserless (V2 — coletor de cidades difíceis) | $10/mês |
| Apollo (V2 — enriquecimento telefone/email) | $50/mês opcional |
| **TOTAL V1** | **$0/mês** |
| **TOTAL V2 completo** | **$10-60/mês** |

---

## 🤝 COMPROMISSO DA ME ENSINA AI

- ✅ Sistema operacional 24/7 (uptime SLA 99.5%+)
- ✅ Atualização quinzenal automatizada (V2)
- ✅ Manutenção continuada (sem custo extra)
- ✅ Suporte WhatsApp em horário comercial Brasil/EUA
- ✅ Adicionar novas cidades quando vocês expandirem mercado

---

**Boa caça, Reginaldo. Manda bem.**

— Equipe Me Ensina AI
Fábio Borges (estratégico) + Carlos AI (técnico)
