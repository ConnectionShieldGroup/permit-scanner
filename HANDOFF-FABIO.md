# HANDOFF FÁBIO — Reunião Reginaldo, segunda 04/mai

> Documento exclusivo Fábio. Roteiro pra entregar Permit Scanner pro Reginaldo + Michel (Connection Glass + Shield Pro) com o mínimo esforço seu.
>
> Status: **V1 pronto com 9 cidades (1.277 permits / ~$95M em obras)**. Falta só o handoff.

## 🎯 NÚMEROS FINAIS PARA REUNIÃO

**1.277 permits residenciais REAIS, 9 cidades MA, ~$95M em obras ativas, 4 técnicas técnicas dominadas.**

| Cidade | Permits | Top sample | Plataforma |
|---|---|---|---|
| **Somerville** | 306 | $14k mansard ledges + 2 bay windows (Williams/Armstrong) | Socrata Open Data |
| **Hingham** | 209 | $203k full exterior renovation (Kevin Green/Green Bros Roofing) | PermitEyes AJAX |
| **Randolph** | 201 | (vidraçaria/proteção) | PermitEyes Browserless |
| **Braintree** | 164 | (RESI. múltiplos) | PermitEyes Browserless |
| **Lexington** | 158 | $12k strip+reroof 30yr GAF (Stephanie Desouza) | CivicPlus CSV |
| **Wakefield** | 107 | $45k REMOVE/REPLACE SIDING (Michael Griffin) | CivicPlus PDF |
| **North Reading** | 71 | (RESI./WIND/ELEC) | PermitEyes Browserless |
| **Reading** | 42 | $44k 11 windows + 1 entry door (Robert Leblanc) | CivicPlus XLSX |
| **Hanson** | 19 | $X enclose existing roofed deck (Darren Reyes) | PermitEyes Browserless |



## ATUALIZAÇÃO 03/mai 16h — V1 SUBIU PRA 4 CIDADES (516 permits / $37M)

Após pesquisa coordenada (Carlos investigando + Fábio pedindo ChatGPT mapear cidades), V1 ampliou pra 4 cidades:

| Cidade | Permits | Plataforma | Método |
|---|---|---|---|
| **Hingham** | 209 | PermitEyes AJAX | Real-time |
| **Lexington** | 158 | CivicPlus CSV | Mensal (delay ~1 mês) |
| **Wakefield** | 107 | CivicPlus PDF | Mensal (delay ~1 mês) |
| **Reading** | 42 | CivicPlus XLSX | Mensal (delay ~3 meses) |
| **TOTAL** | **516** | 3 plataformas, 4 formatos | $37M em obras ativas |

**Cidades testadas mas bloqueadas (V2 essa semana com Browserless):**
- **Waltham** — PDF mensal existe mas Cloudflare bloqueia direct fetch
- **Arlington** — SharePoint XLSX exige login real
- **Wilmington** — Cloudflare bloqueia

**Cidades sem publicação aberta (V2+ com login Reginaldo):**
- 21 cidades das 27 testadas pelo ChatGPT — vão precisar Reginaldo criar contas no PermitEyes/etc

## ATUALIZAÇÃO 03/mai 15h — descoberta arquitetural importante

Após 4h investigando endpoints de TODAS as 30 cidades + tentar login Auth0 do OpenGov com sua conta:

### O que acabei descobrindo (e que não estava no SPEC original)

**Cada cidade MA tem 2 sistemas separados pra permits:**

| Sistema | Tipo de permit | Quem usa | Plataformas |
|---|---|---|---|
| **Public Works portal** | Trench, water/sewer, road work, infraestrutura municipal | Cidade publica abertamente (lei MA c.66) | OpenGov / ViewPoint Cloud |
| **Building/Residential portal** | Kitchen, bath, addition, new construction, alteration | LOGIN obrigatório (contractor/homeowner) | PermitEyes, CivicPlus, CitizenServe, Tyler EnerGov |

**OpenGov das 9 cidades das 30 (Lexington, Stoneham, Reading-tem-também, Arlington, Abington, Hanover, Quincy, Weymouth, Burlington MA):** retorna **só obras públicas**, não residencial. **Não interessa pro Reginaldo.**

**Hingham foi sorte:** o PermitEyes da cidade tem residencial PÚBLICO sem login. Caso raro.
**Reading foi sorte:** publica XLSX residencial mensal via CivicPlus. Caso raro.

### V1 entrega (251 permits residenciais reais)

- **Hingham**: 209 permits (PermitEyes AJAX direto) — pipeline scrape automático
- **Reading**: 42 permits (CivicPlus Excel mensal) — download + parse XLSX

### Pra cobrir as 28 cidades restantes — caminho real

Não existe atalho. Único caminho viável:

1. **Reginaldo cria conta legítima** nos portais das cidades onde ele atua (ele é contractor MA licenciado — tem direito)
2. **A gente usa cookies/token dele** pra acessar dados residenciais via API
3. **Pipeline LLM** extrai dados estruturados (Browserless renderiza, Claude Haiku parseia)
4. **FOIA email automatizado** pra cidades sem portal residencial (Wakefield, Wilmington)

**Tempo realista de cobertura:** 4-6 semanas pra 22-25 cidades das 30 (73-83%).

### Conversa importante com Reginaldo amanhã

Tem que ser HONESTA sobre essa realidade. Mostra V1 (2 cidades reais funcionando), depois explica que:

- Cidades MA não publicam residencial abertamente como faziam antes
- Pra escalar pras 28 restantes, ele cria contas nos portais (10 min cada)
- Cronograma de 4-6 semanas pra cobertura completa
- Sistema dele atual com ChatGPT também só pega o que ele faz manualmente — automação real exige acesso autenticado

Esse é o pitch correto. Não promete 30 amanhã, mas entrega valor real desde o V1.
>
> Tempo total estimado da reunião: **35-45 minutos** dos quais ~10 min você + Reginaldo na frente da tela e o resto eu (Carlos) executando.

---

## 0. Antes da reunião — você prepara em 8 minutos

### a. Conta Supabase do Reginaldo (4 min)

1. Você abre `https://supabase.com/dashboard` (ou ele abre, dependendo de quem vai operar)
2. Login com Google ou GitHub
3. Click "New Project"
4. Preencher:
   - **Name:** `permit-scanner` (ou `connection-glass-permits`)
   - **Organization:** pessoal do Reginaldo (criar se não tem)
   - **Region:** **East US (North Virginia)** ← mais próximo de Massachusetts
   - **Database Password:** anota num lugar seguro (ele depois consegue resetar se perder)
5. Aguardar ~2 min Supabase provisionar
6. Em **Project Settings → API**, copiar 3 strings:
   - `Project URL` (algo tipo `https://xyzabc.supabase.co`)
   - `anon public` (chave pública, pode ir no frontend)
   - `service_role` (chave admin — CUIDADO, é secreta)

### b. Repo GitHub do Reginaldo (2 min)

1. No GitHub do Reginaldo, criar repo novo: `permit-scanner` (privado ou público — tanto faz)
2. NÃO inicializa README (vou empurrar local)
3. Anotar URL (ex: `https://github.com/reginaldo-xyz/permit-scanner`)

### c. Vercel (2 min)

1. Reginaldo entra em `https://vercel.com`
2. Login com GitHub (mesma conta do passo b)
3. Pronto — não cria projeto ainda, vai importar do GitHub no passo final

---

## 1. Quando me chamar — manda em 1 mensagem só

Cola exatamente esse formato no chat (substituindo os valores):

```
Vamos.
URL: https://xxx.supabase.co
ANON: eyJ...
SERVICE_ROLE: eyJ...
GITHUB: github.com/reginaldo/permit-scanner
```

A partir desse momento eu rodo TUDO. Você só observa e fala com Reginaldo.

---

## 2. O que eu faço em sequência (~30 min)

| # | Etapa | Tempo | O que rola na tela |
|---|---|---|---|
| 1 | Linka Supabase CLI ao projeto dele | 30s | comando `supabase link` |
| 2 | Aplica migration (cria tabelas + cron + seed das 30 cidades) | 1 min | abre SQL Editor no Supabase ou roda `supabase db push` |
| 3 | Configura `app_config.service_role_key` (necessário pro cron) | 30s | INSERT no app_config |
| 4 | Deploy Edge Function `scrape-permiteyes` | 1 min | `supabase functions deploy scrape-permiteyes --no-verify-jwt` |
| 5 | Dispara scrape inicial 45 dias pra Hingham | 3-5 min | `curl -X POST .../functions/v1/scrape-permiteyes -d '{"city_slug":"hingham"}'` |
| 6 | Valida que ~209 permits caíram no banco | 30s | `select count(*) from permits` |
| 7 | Aponta frontend pras credenciais novas (.env) | 1 min | edit `.env.local` |
| 8 | Build + push pro GitHub do Reginaldo | 2 min | `git remote add origin ... && git push` |
| 9 | Importa repo no Vercel + configura env vars | 3 min | UI do Vercel — pode pedir você clicar |
| 10 | Vercel build automático + URL pública sai | 2 min | URL `https://permit-scanner-xxx.vercel.app` |
| 11 | Crio handoff doc final pro Reginaldo no repo dele | 5 min | `docs/HANDOFF-REGINALDO.md` no repo |
| 12 | Teste final ponta a ponta na URL Vercel | 2 min | confirma 209 permits aparecendo |

**Total ~30 min de execução, com 5 min de buffer pra qualquer imprevisto.**

---

## 3. Entrega final ao Reginaldo

Mensagem WhatsApp que você manda no fim da reunião (template):

> Reginaldo, entregue. 3 links:
>
> **App permits:** https://permit-scanner-xxx.vercel.app
> **Painel banco** (caso queira ver dados crus): https://supabase.com/dashboard/project/...
> **Repositório:** https://github.com/reginaldo/permit-scanner
>
> Tem **209 permits ativos de Hingham** já no sistema (últimos 45 dias). Atualizado a cada 15 dias automaticamente via cron — dia 1 e 16 do mês, 11h NY.
>
> Doc completo de operação dentro do repo em `docs/HANDOFF-REGINALDO.md`.
>
> Antes de mandar visita pra qualquer permit:
> 1. Olhe o status — só "Permit Issued" estão ativos
> 2. Lembra que telefone/email é do APPLICANT (às vezes é contractor que tá tocando a obra, às vezes é o homeowner)
> 3. Comece testando 5-10 permits pra calibrar a abordagem antes de escalar
>
> Quem é o contato técnico nosso pra dúvidas: você (Fábio)
> Quem é o contato comercial pra evolução: combinar
>
> Próximas evoluções já mapeadas:
> - V2 (semana 12-16/mai): adicionar mais cidades PermitEyes (Norwell, Bedford, Whitman, Scituate, Randolph, North Reading, Hanson, Braintree, Marshfield) — depende dele criar conta no PermitEyes
> - V3+ (final maio): cidades de outras plataformas (OpenGov, SimpliCity, Tyler EnerGov)

---

## 4. PERIGO — discrepância importante a falar com Reginaldo

**No SPEC original eu disse 30 cidades. A realidade testada hoje é diferente:**

| Plataforma | Cidades das 30 dele | V1 (público sem login) | V2 (login required) |
|---|---|---|---|
| **PermitEyes** | 10 cidades | **1 (Hingham)** ✅ | 9 (login required) |
| OpenGov / ViewPoint | 9 cidades | 0 | 9 (Puppeteer + login) |
| SimpliCity | 4 cidades | 0 | 4 |
| Custom / outras | 5 cidades | 0 | 5 |
| FOIA only | 2 cidades | 0 | 0 (manual ou FOIA email) |

**Fala com franqueza pro Reginaldo:**
- V1 entrega Hingham com 209 permits ativos = volume real ($12,5M em obras)
- V2-V5 expande pras outras 28 cidades em fases (semana a semana)
- Algumas cidades ele vai precisar criar conta no portal da prefeitura (pra ter login que a gente usa de bastidor)

Isso é HONESTIDADE necessária. Se ele esperava 30 cidades amanhã, vai vir frustração — melhor alinhar agora.

---

## 5. Material técnico de referência (se ele perguntar)

**Fonte dos dados:**
- PermitEyes (`permiteyes.us/hingham/`) — empresa SaaS que vende software de gestão de permits pras prefeituras americanas
- Endpoint usado: `/ajax/getbuildingpublichome.php` (DataTables server-side público)
- Detalhe enriquecimento: `/building/controller/residential_controller.php` (POST com action=view)
- Endereços, datas, valores — todos campos vêm direto do banco oficial PermitEyes
- 53.562 permits totais em Hingham — a gente filtra os relevantes nos últimos 45 dias

**Lei que permite:**
- Massachusetts Public Records Law (MGL c.66) — todo permit é público por lei
- Não estamos furando nada. É a mesma informação que aparece pro cidadão comum no portal da cidade

**Limitação V1:**
- Drawings/PDFs anexos — não pegamos ainda (V2)
- Estimated value — 96% dos permits têm, 4% vêm sem
- 7 categorias filtradas — se vier "Plumbing" ou "Electrical" puro, descartamos (não relevante pra vidraçaria/proteção)

**TCPA / Privacy:**
- Cold call manual = OK
- SMS automatizado / robocall = atenção, leis federais existem (TCPA)
- Reginaldo é dono dos dados a partir do momento que entram no banco dele

---

## 6. Status final dos arquivos prontos

```
builds/connection-glass-shield-pro/permit-scanner/
├── SPEC.md                                    ← arquitetura completa
├── CONTRACTS.md                               ← contratos backend ↔ frontend
├── cidades-mapeamento.md                      ← 30 cidades mapeadas (corrigido pós Burlington)
├── HANDOFF-FABIO.md                           ← este arquivo
├── tools/scrape-hingham-local.py              ← scraper Python local (V1 demo dev)
├── db/
│   ├── schema.sql                             ← schema atualizado (7 cats + app_date + source_url + description)
│   ├── triggers.sql                           ← auto-create card + auto-move pra Ativos/Não Efetivados
│   ├── seed-cities.sql                        ← seed das 29 cidades MA reais (Burlington Ontario removida)
│   └── cron.sql                               ← cron 11h NY, dia 1 e 16
├── supabase/
│   ├── functions/scrape-permiteyes/index.ts   ← Edge Function v1.1 com TUDO (paginate + enrich + 45/15)
│   └── migrations/20260503000000_init.sql     ← migration consolidada PRONTA pra aplicar
└── app/                                       ← frontend Vite + React (33 arquivos)
    └── src/lib/hingham-real.json              ← 209 permits reais pra dev offline
```

**Build OK. 0 erros TS. Bundle 905KB (gzip 242KB).**

---

## 7. Plano se algo der errado amanhã

| Sintoma | O que faço |
|---|---|
| Supabase migration falha | Cole SQL direto no SQL Editor do Supabase (UI), pula CLI |
| Edge Function deploy falha | Verifico secrets + redeploy com flag `--no-verify-jwt` |
| Scrape de Hingham retorna 0 permits | Testo curl direto, debug do endpoint AJAX |
| Vercel build falha | Geralmente env var faltando — checo `VITE_SUPABASE_*` |
| Frontend mostra "Mock mode" | env vars não foram injetadas — refaço deploy Vercel |

**Pior caso:** se algo grave quebrar e a reunião travar, eu volto pro modo local (`npm run dev` na minha máquina) e Reginaldo vê o V1 funcionando com os 209 permits do JSON local. Daí finalizo deploy depois sem ele na chamada.

---

## 8. O que NÃO entra hoje (V2+ deixar claro)

- ❌ Outras 28 cidades (V1 só Hingham público)
- ❌ Drawings/PDFs anexos (campo extra na V2)
- ❌ Status filter no UI (mostra todos os 209 hoje)
- ❌ Bandeira "Contractor vs Homeowner" no card
- ❌ Notificações Telegram quando permit > $X
- ❌ Export CSV
- ❌ Dashboard de métricas (quantos viraram cliente, conversão, etc)

Cada um desses é trabalho documentado pra próximas semanas.

---

**Boa reunião. Estou pronto.**
— Carlos
