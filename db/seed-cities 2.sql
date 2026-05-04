-- =====================================================================
-- Permit Scanner — Seed das 29 cidades MA reais
-- Cliente: Connection Glass + Shield Pro
-- Data: 2026-05-03 (corrigido após erro de mapeamento Burlington)
--
-- Fonte: cidades-mapeamento.md
-- V1: SÓ Hingham active=true (PermitEyes AJAX validado, 84 permits reais).
-- Burlington MA REMOVIDA do seed: o subagent confundiu Burlington Ontario (CAN) com MA.
-- Burlington MA real é OpenGov SPA React, fica pra V4.
-- Demais cidades active=false até parser ser criado.
-- =====================================================================

insert into cities_config (name, state, platform, base_url, parser_name, active, notes) values
  -- ===== ÚNICA ATIVA V1 =====
  ('Hingham',          'MA', 'permiteyes',
   'https://permiteyes.us/hingham/publicview.php',
   'scrape-permiteyes', true,
   'V1 ALVO. AJAX endpoint /ajax/getbuildingpublichome.php retorna JSON com 84+ permits reais. Padrão cobre 9 outras cidades PermitEyes em V2.'),

  -- ===== Norte/NW Boston (14 — sem Burlington) =====
  ('Lexington',        'MA', 'opengov_viewpoint',
   'https://lexingtonma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. Search público mas precisa Puppeteer ou interceptar XHR. V4.'),

  ('Winchester',       'MA', 'civicplus_custom',
   'https://www.winchester.us/899/Online-Building-Permits',
   'scrape-html-generic', false,
   'Login obrigatório. Backlog V6+ ou abandona.'),

  ('Stoneham',         'MA', 'opengov_viewpoint',
   'https://stonehamma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. Public records search via portal. V4.'),

  ('Reading',          'MA', 'opengov_viewpoint',
   'https://readingma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. Tem também Monthly Building Permit Report PDF. V4.'),

  ('Wakefield',        'MA', 'foia_only',
   'https://www.wakefield.ma.us/inspectional-services-zoning',
   'request-foia', false,
   'Building permits NÃO estão online. FOIA via c.66. Excluído V1-V5.'),

  ('Wilmington',       'MA', 'foia_only',
   'https://www.wilmingtonma.gov/building-inspector',
   'request-foia', false,
   'Sem portal público. Town Hall ou FOIA. Excluído V1-V5.'),

  ('North Reading',    'MA', 'permiteyes',
   'https://permiteyes.us/northreading/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes publicview ABERTO. EASY-MEDIUM. V2.'),

  ('Medford',          'MA', 'citizenserve',
   'https://www2.citizenserve.com/Portal/?installationid=315',
   'scrape-citizenserve', false,
   'Login obrigatório. Backlog V6+.'),

  ('Melrose',          'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/simplicity/building_permits.php?client=melrosema',
   'scrape-simplicity', false,
   'MapsOnline padrão. HTML estável. V3.'),

  ('Arlington',        'MA', 'opengov_viewpoint',
   'https://arlingtonma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. V4.'),

  ('Malden',           'MA', 'tyler_energov',
   'https://maldenma-energovweb.tylerhost.net/apps/SelfService',
   'scrape-tyler-energov', false,
   'Tyler EnerGov self-service exige conta. Backlog V6+.'),

  ('Billerica',        'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/simplicity/building_permits.php?client=billericama&use_react=yes',
   'scrape-simplicity', false,
   'MapsOnline com React. Endpoint público. V3.'),

  ('Bedford',          'MA', 'permiteyes',
   'https://permiteyes.us/bedford/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar publicview ativo. V2.'),

  ('Waltham',          'MA', 'custom',
   'https://www.city.waltham.ma.us/building-department/pages/issued-permits',
   'scrape-waltham-custom', false,
   'Sistema custom. Search by address público. V5.'),

  -- ===== South Shore (15) =====
  ('Abington',         'MA', 'opengov_viewpoint',
   'https://abingtonma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'OpenGov padrão. V4.'),

  ('Whitman',          'MA', 'permiteyes',
   'https://permiteyes.us/whitman/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar publicview ativo. V2.'),

  ('Hanover',          'MA', 'opengov_viewpoint',
   'https://hanoverma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'OpenGov + alias ViewpointCloud. V4.'),

  -- Hingham: registro V1 ativo já incluído no topo do INSERT (active=true). Duplicata removida 03/mai.

  ('Weymouth',         'MA', 'opengov_viewpoint',
   'https://www.weymouth.ma.us/1675/Online-Permit-Application',
   'scrape-opengov-viewpoint', false,
   'Provável OpenGov via auth.viewpointcloud.com. V4.'),

  ('Braintree',        'MA', 'permiteyes',
   'https://permiteyes.us/braintree/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar publicview ativo. V2.'),

  ('Quincy',           'MA', 'opengov_viewpoint',
   'https://quincyma.viewpointcloud.com/search',
   'scrape-opengov-viewpoint', false,
   'SPA React. Cidade grande = volume alto. V4.'),

  ('Norwell',          'MA', 'permiteyes',
   'https://permiteyes.us/norwell/publichome.php',
   'scrape-permiteyes', false,
   'PermitEyes publichome confirmado. V2.'),

  ('Scituate',         'MA', 'permiteyes',
   'https://permiteyes.us/scituate/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — todos permits online desde 2021. V2.'),

  ('Marshfield',       'MA', 'permiteyes_net',
   'https://permiteyes.net/MarBldg/user_logins.asp',
   'scrape-permiteyes-net', false,
   'Variant PermitEyes (.net + ASP). Public Records Search. V2.'),

  ('Pembroke',         'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/pembrokema/permit_public_portal.php',
   'scrape-simplicity', false,
   'MapsOnline permit_public_portal ABERTO. ALVO TOP V3.'),

  ('Hanson',           'MA', 'permiteyes',
   'https://permiteyes.us/hanson/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar URL ativo. V2.'),

  ('East Bridgewater', 'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/eastbridgewaterma/online_permits/',
   'scrape-simplicity', false,
   'Dois portais (SmartGov + MapsOnline). V3.'),

  ('Brockton',         'MA', 'citizenserve',
   'https://www4.citizenserve.com/Portal/PortalController?Action=showSearchPage&ctzPagePrefix=Portal_&installationID=390',
   'scrape-citizenserve', false,
   'CitizenServe search público (sem login). Cidade grande. V5.'),

  ('Randolph',         'MA', 'permiteyes',
   'https://permiteyes.us/randolph/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes publicview confirmado. 20 tipos de permit. V2.')
on conflict (name, state) do update
  set platform    = excluded.platform,
      base_url    = excluded.base_url,
      parser_name = excluded.parser_name,
      notes       = excluded.notes;
-- Nota: ON CONFLICT NÃO atualiza `active`. Isso é intencional — se Carlos
-- ativou alguma cidade manualmente, re-rodar o seed não desativa.
