# Mapeamento de Portais de Building Permits — 30 Cidades MA

**Cliente:** Connection Glass + Shield Pro
**Objetivo:** scrape quinzenal de novos building permits (foco: New Construction, Kitchen Reno, Bath Reno, Addition)
**Data da pesquisa:** 03 de maio de 2026
**Pesquisador:** Carlos (orquestrado) via WebSearch

---

## Resumo Executivo

| Categoria | Quantidade | % |
|---|---|---|
| EASY (API publica ou JSON aberto) | 1 | 3% |
| MEDIUM (HTML scraping publico, sem login) | 17 | 57% |
| HARD (login obrigatorio pra ver dados) | 9 | 30% |
| VERY_HARD / NONE / FOIA_ONLY | 3 | 10% |

**Plataforma dominante:** OpenGov / ViewPoint Cloud (10 cidades) + PermitEyes (8 cidades). Juntos cobrem 60% das cidades.

### Top 5 Candidatas pra Cidade-Piloto

1. **Burlington (#1)** — UNICA com API ArcGIS/JSON publica (Hub navburl-burlington.opendata.arcgis.com). Download CSV/GeoJSON direto, zero scraping. Comecar AQUI.
2. **North Reading (#8)** — PermitEyes tem URL `/publicview.php` aberta, lista permits sem login. HTML simples de parsear.
3. **Pembroke (#26)** — Simplicity/MapsOnline tem `permit_public_portal.php` publico. Mesma estrutura usada por East Bridgewater e Billerica (3 cidades de uma so vez se o parser for generico).
4. **East Bridgewater (#28)** — Mesma plataforma da Pembroke (MapsOnline) + SmartGov Public Portal. Dois caminhos publicos.
5. **Hingham (#19)** — PermitEyes `/publichome.php` com publico explicito ("permits 2010-presente"). Maior volume South Shore.

**Estrategia de rollout:**
- Semana 1: piloto em Burlington (ArcGIS API), validar fluxo de notificacao Connection Glass.
- Semana 2: adicionar 7 cidades PermitEyes (mesmo HTML pattern: North Reading, Bedford, Whitman, Hingham, Norwell, Scituate, Hanson, Randolph, Braintree). Um parser cobre todas.
- Semana 3: adicionar 3 cidades MapsOnline/Simplicity (Pembroke, East Bridgewater, Billerica, Melrose). Parser proprio.
- Semana 4: tentar OpenGov/ViewPoint (Lexington, Stoneham, Reading, Arlington, Hanover, Quincy, Abington, Burlington-OG). Pode precisar de Puppeteer porque e SPA React.
- Cidades HARD/login (Medford, Malden, Brockton, Wilmington-MUNIS) — adiar pra Fase 2 ou abandonar.

---

## Tabela Completa

| # | Cidade | Plataforma | Acesso | URL do Portal | API/JSON? | Tipos Cobertos | Dificuldade | Notas |
|---|---|---|---|---|---|---|---|---|
| 1 | Burlington | OpenGov + ArcGIS Open Data | PUBLIC | https://burlingtonma.portal.opengov.com/ + https://navburl-burlington.opendata.arcgis.com/datasets/building-permits | **SIM — ArcGIS REST API + GeoJSON + CSV download** | Building, electrical, plumbing, gas | EASY | Unica cidade com dataset estruturado publico. ArcGIS Hub e o caminho de menor atrito. ALVO #1. |
| 2 | Lexington | OpenGov / ViewPoint Cloud | LOGIN_REQUIRED p/ aplicar; busca publica via URL `/search` | https://lexingtonma.portal.opengov.com/ | Possivel via ViewPoint search endpoint (HTML/SPA) | Building, electrical, plumbing/gas, engineering | HARD | OpenGov mostra permits issued sem login mas eh SPA React — precisa Puppeteer. |
| 3 | Winchester | CivicPlus + portal proprio (registro requerido) | LOGIN_REQUIRED | https://www.winchester.us/899/Online-Building-Permits | Nao | Building, zoning, demolition, driveway, wetland, variance, dev, tank, tents | HARD | Precisa criar conta para submeter. Busca publica nao confirmada. |
| 4 | Stoneham | OpenGov / ViewPoint Cloud | PUBLIC (search) / LOGIN p/ apply | https://stonehamma.portal.opengov.com/ | SPA React | Building, electrical, plumbing, gas | MEDIUM | OpenGov padrao MA. Public records search disponivel via portal. |
| 5 | Reading | OpenGov / ViewPoint Cloud | PUBLIC (search) | https://readingma.portal.opengov.com/ | SPA React | Building, electrical, plumbing, gas | MEDIUM | Tem tambem "Monthly Building Permit Report" PDF em readingma.gov/959. |
| 6 | Wakefield | ViewPoint (parcial) | NONE para building permits online | https://www.wakefield.ma.us/inspectional-services-zoning | Nao | ViewPoint usado so p/ parking/business — building NAO esta online | VERY_HARD | Edital diz "building permit applications are not yet online". FOIA-only para dados de building. |
| 7 | Wilmington | Sem portal publico de busca (MUNIS link e Wilmington DE, nao MA) | FOIA_ONLY | https://www.wilmingtonma.gov/building-inspector | Nao | Sem busca publica online | VERY_HARD | Confirmado: o "munisselfservice" e Wilmington Delaware. MA so tem PDFs/forms. Solicitar via c.66 ou visitar Town Hall. |
| 8 | North Reading | PermitEyes | PUBLIC (publicview) | https://permiteyes.us/northreading/publicview.php | HTML scraping facil | Building, electrical, plumbing, gas | EASY-MEDIUM | URL `publicview.php` aberta, lista permits por endereco. 2019+ digital, anteriores so em Town Hall. |
| 9 | Medford | CitizenServe | LOGIN_REQUIRED p/ search | https://www2.citizenserve.com/Portal/?installationid=315 | Nao publico | Building, plumbing, gas, electrical, sheet metal, periodic | HARD | "Apply here" abre busca, mas precisa conta. Verificar se installationid=315 tem search publico. |
| 10 | Melrose | SimpliCity (MapsOnline / PeopleGIS) | PUBLIC (search) | https://www.mapsonline.net/simplicity/building_permits.php?client=melrosema | HTML | Building, electrical, mechanical, plumbing, gas | MEDIUM | URL com `client=melrosema` e o padrao MapsOnline. Public records search confirmada. |
| 11 | Arlington | OpenGov / ViewPoint Cloud | PUBLIC (search) / LOGIN p/ apply | https://arlingtonma.portal.opengov.com/ | SPA React | Building, electrical, plumbing, gas, demo, signs, dumpsters, sheet metal | MEDIUM | Tambem tem `arlserver.town.arlington.ma.us/buildingpermits/` (sistema legado, possivelmente HTML mais simples). |
| 12 | Malden | Tyler EnerGov (tylerhost.net) | LOGIN_REQUIRED | https://maldenma-energovweb.tylerhost.net/apps/SelfService | Nao publico | Building, electrical, plumbing, gas, sheet metal, sprinkler | HARD | EnerGov self-service exige conta. Contractors only para alguns tipos. |
| 13 | Billerica | SimpliCity (MapsOnline) | PUBLIC | https://www.mapsonline.net/simplicity/building_permits.php?client=billericama&use_react=yes | HTML (React, mas com endpoint publico) | Building, electrical, plumbing, gas, fire | MEDIUM | Mesma plataforma de Melrose/Pembroke/East Bridgewater — parser unico cobre 4 cidades. |
| 14 | Bedford | PermitEyes | LOGIN p/ apply, busca publica nao confirmada | https://permiteyes.us/bedford/loginuser.php | HTML (se publicview existir) | Building, electrical, plumbing, gas | MEDIUM | Tentar `https://permiteyes.us/bedford/publicview.php` — padrao PermitEyes. |
| 15 | Waltham | Portal proprio "Issued Permits" | PUBLIC (busca por endereco) | https://www.city.waltham.ma.us/building-department/pages/issued-permits | HTML | Building, plumbing, electrical, gas, fire, wires | MEDIUM | Sistema custom da cidade. Search by address publico. Permits prefixo P/A/W/F/Z/Y/X/Q. |
| 16 | Abington | OpenGov / ViewPoint Cloud | PUBLIC (search) / LOGIN p/ apply | https://abingtonma.portal.opengov.com/ | SPA React | Building, electrical, plumbing, gas, sheet metal, in-law affidavit | MEDIUM | OpenGov padrao. |
| 17 | Whitman | PermitEyes | LOGIN p/ apply; tentar publicview | https://permiteyes.us/whitman/loginuser.php | HTML | Building, electrical, gas, plumbing | MEDIUM | Padrao PermitEyes. |
| 18 | Hanover | OpenGov / ViewPoint Cloud | PUBLIC (search) | https://hanoverma.portal.opengov.com/ (tambem HanoverMA.ViewpointCloud.com) | SPA React | Building, electrical, plumbing, gas | MEDIUM | OpenGov + alias ViewpointCloud. |
| 19 | Hingham | PermitEyes | PUBLIC (publichome) | https://permiteyes.us/hingham/publichome.php | HTML | Building (residencial+comercial), plumbing, gas, electrical, sheet metal, tent, sign, solid fuel | EASY-MEDIUM | "Public listing of building permits" explicito. 2010-presente. ALVO TOP. |
| 20 | Weymouth | OpenGov / ViewPoint Cloud (provavel) | PUBLIC (search) | https://www.weymouth.ma.us/1675/Online-Permit-Application | SPA React | Building (alteration+new), demo, electrical, gas, plumbing, sheet metal, sign, swimming pool | MEDIUM | URL direto do portal nao confirmado mas auth.viewpointcloud.com aparece. Public records on file. |
| 21 | Braintree | PermitEyes | LOGIN p/ apply; tentar publicview | https://permiteyes.us/braintree/loginuser.php | HTML | Building, electrical, plumbing, gas, health | MEDIUM | Padrao PermitEyes. |
| 22 | Quincy | OpenGov / ViewPoint Cloud (dual) | PUBLIC (search) | https://quincyma.viewpointcloud.com/search + https://quincyma.portal.opengov.com/ | SPA React | Building, electrical, gas, plumbing | MEDIUM | URL `/search` direto e o atalho. Cidade grande = volume alto. |
| 23 | Norwell | PermitEyes | PUBLIC (publichome) | https://permiteyes.us/norwell/publichome.php | HTML | Building, electrical, plumbing, gas | EASY-MEDIUM | Padrao PermitEyes com publichome confirmado. |
| 24 | Scituate | PermitEyes | LOGIN p/ apply; tentar publicview | https://permiteyes.us/scituate/loginuser.php | HTML | Building, electrical, plumbing, gas | MEDIUM | "All permits online only" desde 2021. Padrao PermitEyes. |
| 25 | Marshfield | PermitEyes (host `.net` em vez de `.us`) | PUBLIC (Public Records Search) | https://permiteyes.net/MarBldg/user_logins.asp | HTML | Building, electrical, plumbing, gas | MEDIUM | Variant PermitEyes (.net + ASP). "Public Records Search" feature mencionada — sem login. |
| 26 | Pembroke | SimpliCity (MapsOnline) | PUBLIC | https://www.mapsonline.net/pembrokema/permit_public_portal.php | HTML | Building, electrical, sheet metal, plumbing, gas | MEDIUM | URL `permit_public_portal.php` confirmado publico. ALVO TOP. |
| 27 | Hanson | PermitEyes | LOGIN_REQUIRED p/ apply; tentar publicview | https://permiteyes.us/hanson/loginuser.php (alt: https://permiteyes.com/Hanson/bldg/user_logins.asp) | HTML | Building, gas, plumbing, electrical | MEDIUM | Dois URLs PermitEyes mencionados. Confirmar qual esta ativo. |
| 28 | East Bridgewater | SmartGov + MapsOnline (dois sistemas) | PUBLIC | https://twn-eastbridgewater-ma.smartgovcommunity.com/ + https://www.mapsonline.net/eastbridgewaterma/online_permits/ | HTML | Building, electrical, gas, plumbing, sheet metal | MEDIUM | Dois portais publicos disponiveis. |
| 29 | Brockton | CitizenServe (installationID=390) | PUBLIC (search page) | https://www4.citizenserve.com/Portal/PortalController?Action=showSearchPage&ctzPagePrefix=Portal_&installationID=390 | HTML | Building (residencial+comercial), electrical, plumbing | MEDIUM | Search page existe sem login. Cidade grande = volume alto. CitizenServe scraping doc-disponivel. |
| 30 | Randolph | PermitEyes | PUBLIC (publicview) | https://permiteyes.us/randolph/publicview.php | HTML | Building, electrical, plumbing, gas, paving, driveway, stormwater (20 tipos) | EASY-MEDIUM | publicview confirmado. 20 tipos de permit. |

---

## Plataformas — Resumo de Implementacao

| Plataforma | Cidades | Padrao URL Publica | Estrategia Scraping |
|---|---|---|---|
| **OpenGov / ViewPoint Cloud** | Burlington, Lexington, Stoneham, Reading, Arlington, Abington, Hanover, Quincy, Weymouth (provavel) | `<city>ma.portal.opengov.com` ou `<city>ma.viewpointcloud.com/search` | SPA React — Puppeteer/Playwright. Endpoint /search retorna JSON via XHR (interceptar). |
| **PermitEyes** | North Reading, Bedford, Whitman, Hingham, Norwell, Scituate, Marshfield (.net), Hanson, Braintree, Randolph | `permiteyes.us/<city>/publicview.php` ou `/publichome.php` | HTML server-rendered. BeautifulSoup/Cheerio. Variante .net (Marshfield) tem ASP. |
| **SimpliCity / MapsOnline** | Melrose, Billerica, Pembroke, East Bridgewater | `mapsonline.net/<city>ma/...` ou `mapsonline.net/simplicity/building_permits.php?client=<city>ma` | HTML (alguns React). Endpoint estavel. |
| **CitizenServe** | Medford (315), Brockton (390) | `citizenserveN.com/Portal/...?installationID=XXX` | HTML. Search publico em alguns, login em outros. |
| **Tyler EnerGov** | Malden | `<city>-energovweb.tylerhost.net/apps/SelfService` | Self-service exige conta. HARD. |
| **SmartGov** | East Bridgewater | `twn-<city>-ma.smartgovcommunity.com` | HTML. |
| **ArcGIS Hub Open Data** | Burlington (unica) | `<city>.opendata.arcgis.com/datasets/building-permits` | API REST + GeoJSON + CSV. EASIEST. |
| **Custom proprio** | Winchester, Waltham | URL da prefeitura | Caso a caso. Waltham tem search publico simples. |
| **Sem portal / FOIA only** | Wakefield (parcial), Wilmington | — | Solicitar via Massachusetts Public Records Law c.66. |

---

## Notas de Honestidade

- **Wakefield:** ViewPoint existe mas building permits ainda NAO estao online (texto explicito do site). Tratado como FOIA_ONLY ate prova em contrario.
- **Wilmington MA:** O resultado de busca apontando p/ MUNIS (`cityofwilmingtondecitizens.munisselfservice.com`) e Wilmington Delaware — confundido pela proximidade de nome. MA nao tem busca publica online, so PDFs e Town Hall.
- **PermitEyes login URLs:** Quando so achei `loginuser.php`, tentei o padrao `publicview.php` / `publichome.php` na URL — esse padrao existe mas nem todo PermitEyes ativa ele. Validacao manual no piloto. 
- **OpenGov/ViewPoint:** SPA React. Scraping vai exigir Puppeteer ou interceptar chamadas XHR (que retornam JSON). Mais trabalho que PermitEyes/MapsOnline.
- **Difficulty rating:** EASY = API publica direta, MEDIUM = HTML/JSON publico exige scraper customizado, HARD = login obrigatorio mesmo p/ leitura, VERY_HARD = FOIA / sem portal.

---

## Proximos Passos Recomendados

1. **Validar Burlington ArcGIS** — confirmar que o endpoint REST aceita query por data (ultimos 15 dias) e retorna campos uteis (tipo, endereco, valor). Se sim, MVP em 1 dia.
2. **Auditar PermitEyes batch** — script que tenta `publicview.php` em todas 10 cidades PermitEyes ao mesmo tempo. Confirmar quais sao publicas.
3. **Mapear OpenGov XHR** — abrir DevTools em Lexington/Quincy e capturar a chamada XHR que popula a search. Provavelmente retorna JSON. Se for o caso, todas 9 OpenGov sao MEDIUM (nao HARD).
4. **Decidir corte:** com 17 MEDIUM + 1 EASY, o cliente ja tem 18 cidades cobertas (60%). Os 9 HARD podem virar Fase 2 ou nunca — depende do ROI.

