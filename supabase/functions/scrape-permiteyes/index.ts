// =====================================================================
// Edge Function: scrape-permiteyes
// Cliente: Connection Glass + Shield Pro (Reginaldo + Michel)
// Atualizado: 2026-05-03 (V1.1 — pós-descobertas reais)
//
// Scraper PermitEyes com:
//  - Paginação DataTables (length=500, order=IssueDate desc)
//  - Cutoff temporal: 45 dias na primeira execução, 15 dias depois
//  - 7 categorias filtradas (skip non-relevant)
//  - Skip Closed / CO Issued
//  - Enrichment via residential_controller.php (phone/email/value/desc)
//  - source_url com UUIDs extraídos dos botões da home
//  - 2 datas: permit_date (IssueDate) + application_date (ApplDate)
//
// Body opcional:
//   { "city_slug": "hingham" }       → scrapa só essa cidade
//   { "days_back": 45 }              → override cutoff (default: 45 se nunca rodou, 15 senão)
//   {}                               → todas active=true platform='permiteyes'
//
// Deploy: supabase functions deploy scrape-permiteyes --no-verify-jwt
// =====================================================================

// @ts-ignore — Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------

type WorkType =
  | "new_construction"
  | "kitchen_renovation"
  | "bath_renovation"
  | "addition"
  | "renovation"
  | "building_permit"
  | "foundation_permit";

type CityConfig = {
  id: string;
  name: string;
  state: string;
  platform: string;
  base_url: string;
  parser_name: string;
  active: boolean;
  last_run: string | null;
};

type CityResult = {
  fetched_raw: number;
  inserted: number;
  updated: number;
  skipped_too_old: number;
  skipped_not_relevant: number;
  skipped_closed: number;
  skipped_no_permit_number: number;
  enrichment_failures: number;
};

type RunResponse = {
  ok: boolean;
  by_city: Record<string, CityResult>;
  errors: Array<{ city: string; error: string }>;
  duration_ms: number;
};

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const PAGE_SIZE = 500;
const DEFAULT_FIRST_RUN_DAYS = 45;
const DEFAULT_SUBSEQUENT_DAYS = 15;
const ENRICHMENT_THROTTLE_MS = 250;
const FETCH_TIMEOUT_MS = 30_000;
const ENRICHMENT_TIMEOUT_MS = 20_000;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function cleanHtml(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function parsePermitEyesDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = cleanHtml(raw);
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;

  const mm = parseInt(m[1], 10);
  const dd = parseInt(m[2], 10);
  let yyyy = parseInt(m[3], 10);

  if (m[3].length === 2) {
    yyyy = yyyy < 50 ? 2000 + yyyy : 1900 + yyyy;
  }
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/**
 * 7 categorias relevantes pro Reginaldo. Retorna null pra skip permits
 * que não são de construção/renovação relevantes (PLUMB, ELEC, GAS, SIGN, etc).
 *
 * Ordem importa: específicos primeiro (new_construction, kitchen, bath,
 * addition), depois renovation genérica, depois foundation, building_permit
 * último (pega RESI./COMM. genéricos sem descrição).
 */
function inferWorkType(rawType: string, description: string): WorkType | null {
  const combined = `${rawType} ${description}`.toLowerCase();

  if (
    combined.includes("new construction") ||
    combined.includes("new home") ||
    combined.includes("new single family") ||
    combined.includes("new dwelling") ||
    combined.includes("construct new") ||
    combined.includes("new const") ||
    combined.includes("n.c.") ||
    combined.includes("newconst") ||
    combined.includes("new house")
  ) {
    return "new_construction";
  }

  if (
    combined.includes("kitchen remodel") ||
    combined.includes("kitchen renovation") ||
    combined.includes("kitchen reno") ||
    combined.includes("kitchen") ||
    combined.includes("kit.")
  ) {
    return "kitchen_renovation";
  }

  if (
    combined.includes("bathroom remodel") ||
    combined.includes("bath renovation") ||
    combined.includes("bath remodel") ||
    combined.includes("bathroom") ||
    combined.includes("bath")
  ) {
    return "bath_renovation";
  }

  if (
    combined.includes("room addition") ||
    combined.includes("garage addition") ||
    combined.includes("second story addition") ||
    combined.includes("addition") ||
    combined.includes("add.")
  ) {
    return "addition";
  }

  if (
    combined.includes("interior renovation") ||
    combined.includes("residential renovation") ||
    combined.includes("commercial renovation") ||
    combined.includes("basement remodel") ||
    combined.includes("build-out") ||
    combined.includes("build out") ||
    combined.includes("tenant fit-out") ||
    combined.includes("tenant fit out") ||
    combined.includes("remodel") ||
    combined.includes("alteration") ||
    combined.includes("alter ") ||
    combined.includes("renovation")
  ) {
    return "renovation";
  }

  if (
    combined.includes("foundation permit") ||
    combined.includes("foundation")
  ) {
    return "foundation_permit";
  }

  if (
    combined.includes("building permit") ||
    combined.includes("resi.") ||
    combined.includes("comm.")
  ) {
    return "building_permit";
  }

  return null; // SKIP — permit não relevante
}

function isStatusClosed(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("closed") || s.includes("co issued");
}

/**
 * Extrai data-application-id e data-permit-id de col[0] ou col[1] (HTML).
 * Esses UUIDs vão pro source_url.
 */
function extractDataAttrs(html: unknown): { applicationId: string | null; permitUuid: string | null } {
  if (typeof html !== "string") return { applicationId: null, permitUuid: null };
  const appMatch = html.match(/data-application-id=["']([a-f0-9-]+)["']/);
  const permMatch = html.match(/data-permit-id=["']([a-f0-9-]+)["']/);
  return {
    applicationId: appMatch ? appMatch[1] : null,
    permitUuid: permMatch ? permMatch[1] : null,
  };
}

function buildAddress(num: string, street: string, fallbackCity: string): string {
  const n = (num || "").trim();
  const s = (street || "").trim();
  if (s) {
    const combined = n ? `${n} ${s}` : s;
    return titleCase(combined);
  }
  return `${fallbackCity}, MA`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function slugFromBaseUrl(baseUrl: string): string | null {
  const m = baseUrl.match(/permiteyes\.us\/([^\/]+)\//);
  return m ? m[1] : null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        ...(init.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(tid);
  }
}

// ---------------------------------------------------------------------
// Detail enrichment (POST residential_controller.php)
// ---------------------------------------------------------------------

type DetailEnrichment = {
  phone: string | null;
  email: string | null;
  estimated_value: number | null;
  applicant_name: string | null;
  description: string | null;
  permit_date: string | null;
  application_date: string | null;
  address_override: string | null;
  owner_name: string | null;
  map_block_lot: string | null;
  zone: string | null;
  square_area_work: number | null;
};

async function fetchPermitDetail(
  slug: string,
  applicationId: string,
): Promise<DetailEnrichment | null> {
  const url = `https://permiteyes.us/${slug}/building/controller/residential_controller.php`;
  const body = new URLSearchParams({
    action: "view",
    ApplicationId: applicationId,
  }).toString();

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
      ENRICHMENT_TIMEOUT_MS,
    );

    if (!res.ok) {
      console.warn(`[enrich] HTTP ${res.status} for ${slug}/${applicationId.slice(0, 8)}`);
      return null;
    }

    const text = await res.text();
    const detail = JSON.parse(text);
    const app = detail?.Application;
    if (!app || typeof app !== "object") return null;

    const res2 = detail?.Residential;
    let sqArea: number | null = null;
    if (res2 && res2.SquareAreaWork) {
      const n = parseInt(String(res2.SquareAreaWork), 10);
      if (!isNaN(n) && n > 0) sqArea = n;
    }

    let cost: number | null = null;
    if (app.EstimatedCost && String(app.EstimatedCost).trim() !== "" && String(app.EstimatedCost) !== "0") {
      const c = parseFloat(String(app.EstimatedCost).replace(/[$,]/g, ""));
      if (!isNaN(c)) cost = c;
    }

    const issueDate = String(app.IssueDate || "").trim();
    const applDate = String(app.ApplDate || "").trim();

    const siteNum = String(app.SiteStNum || "").trim();
    const siteStreet = String(app.SiteStName || "").trim();
    let addressOverride: string | null = null;
    if (siteStreet) {
      addressOverride = titleCase(siteNum ? `${siteNum} ${siteStreet}` : siteStreet);
    }

    const appPhone = String(app.AppPhone || "").trim();
    const appEmail = String(app.AppEmail || "").trim();
    const ownerPhone = String(app.OwnerPhone || "").trim();
    const ownerEmail = String(app.OwnerEmail || "").trim();

    return {
      phone: appPhone || ownerPhone || null,
      email: appEmail || ownerEmail || null,
      estimated_value: cost,
      applicant_name: String(app.AppName || "").trim() || null,
      description: String(app.BriefDescription || "").trim() || null,
      permit_date: issueDate && issueDate !== "0000-00-00" ? issueDate : null,
      application_date: applDate && applDate !== "0000-00-00" ? applDate : null,
      address_override: addressOverride,
      owner_name: String(app.OwnerName || "").trim() || null,
      map_block_lot: String(app.MapBlockLot || "").trim() || null,
      zone: String(app.Zone || "").trim() || null,
      square_area_work: sqArea,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[enrich] failed ${slug}/${applicationId.slice(0, 8)}: ${msg}`);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------
// Core: scrape de UMA cidade
// ---------------------------------------------------------------------

async function scrapeCity(
  supabase: SupabaseClient,
  city: CityConfig,
  daysBack: number,
): Promise<CityResult> {
  const slug = slugFromBaseUrl(city.base_url);
  if (!slug) {
    throw new Error(
      `cities_config.base_url não casa com permiteyes.us/<slug>/: ${city.base_url}`,
    );
  }

  // 1) Fetch listagem com paginação + ordering por IssueDate desc
  const params = new URLSearchParams({
    draw: "1",
    start: "0",
    length: String(PAGE_SIZE),
    "order[0][column]": "6",
    "order[0][dir]": "desc",
  });
  const ajaxUrl = `https://permiteyes.us/${slug}/ajax/getbuildingpublichome.php?${params}`;

  const res = await fetchWithTimeout(ajaxUrl);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} de ${ajaxUrl}`);
  }
  const text = await res.text();
  let payload: { data?: unknown[][]; recordsTotal?: number };
  try {
    payload = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `JSON malformado de ${ajaxUrl}: ${(e as Error).message} (preview: ${text.slice(0, 200)})`,
    );
  }
  const rows = payload?.data;
  if (!Array.isArray(rows)) {
    throw new Error(`Resposta sem 'data' array em ${ajaxUrl}.`);
  }

  // 2) Cutoff temporal
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const result: CityResult = {
    fetched_raw: rows.length,
    inserted: 0,
    updated: 0,
    skipped_too_old: 0,
    skipped_not_relevant: 0,
    skipped_closed: 0,
    skipped_no_permit_number: 0,
    enrichment_failures: 0,
  };

  // 3) Itera permits (filtros + enrichment + upsert)
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 17) {
      result.skipped_no_permit_number += 1;
      continue;
    }

    // Extrai UUIDs ANTES de cleanHtml (precisa do markup)
    const ids = extractDataAttrs(row[0]);
    const ids2 = extractDataAttrs(row[1]);
    const applicationId = ids.applicationId || ids2.applicationId;
    const permitUuid = ids.permitUuid || ids2.permitUuid;

    const cleaned = row.map(cleanHtml);

    const permitNumber = cleaned[14] ?? "";
    if (!permitNumber) {
      result.skipped_no_permit_number += 1;
      continue;
    }

    // Cutoff por data (col[6] = IssueDate)
    const dateFromList = parsePermitEyesDate(cleaned[6]) ?? parsePermitEyesDate(cleaned[5]);
    if (!dateFromList || dateFromList < cutoffDate) {
      result.skipped_too_old += 1;
      continue;
    }

    // Filtra: só 7 categorias relevantes
    const rawType = cleaned[13] ?? "";
    const description = cleaned[12] ?? "";
    const workType = inferWorkType(rawType, description);
    if (workType === null) {
      result.skipped_not_relevant += 1;
      continue;
    }

    // Skip Closed / CO Issued
    const statusSource = cleaned[15] ?? null;
    if (statusSource && isStatusClosed(statusSource)) {
      result.skipped_closed += 1;
      continue;
    }

    // 4) Enrichment via residential_controller.php
    let enrichment: DetailEnrichment | null = null;
    if (applicationId) {
      enrichment = await fetchPermitDetail(slug, applicationId);
      if (!enrichment) result.enrichment_failures += 1;
      await sleep(ENRICHMENT_THROTTLE_MS);
    } else {
      result.enrichment_failures += 1;
    }

    // 5) Compõe payload final (enrichment > listagem como source of truth)
    const houseNum = cleaned[8] ?? "";
    const street = cleaned[9] ?? "";
    const addressFromList = buildAddress(houseNum, street, city.name);
    const address = enrichment?.address_override || addressFromList;

    const applicantFromList = cleaned[10] || cleaned[11] || null;
    const applicantName = enrichment?.applicant_name
      ? titleCase(enrichment.applicant_name)
      : (applicantFromList ? titleCase(applicantFromList) : null);

    const finalDescription = enrichment?.description || description || null;
    const finalPermitDate = enrichment?.permit_date || dateFromList;
    const finalApplicationDate = enrichment?.application_date || null;

    const sourceUrl = applicationId && permitUuid
      ? `https://permiteyes.us/${slug}/building/residentialview.php?application_id=${applicationId}&permit_id=${permitUuid}`
      : `https://permiteyes.us/${slug}/publicview.php`;

    const rawData = {
      source: "permiteyes",
      city_slug: slug,
      type_raw: rawType,
      permit_id_internal: cleaned[4],
      application_id: applicationId,
      permit_uuid: permitUuid,
      owner_name: enrichment?.owner_name ? titleCase(enrichment.owner_name) : null,
      map_block_lot: enrichment?.map_block_lot,
      zone: enrichment?.zone,
      square_area_work: enrichment?.square_area_work,
      scraped_at: new Date().toISOString(),
    };

    // 6) Upsert (idempotente por permit_number)
    const { data: existing, error: selErr } = await supabase
      .from("permits")
      .select("id")
      .eq("permit_number", permitNumber)
      .maybeSingle();

    if (selErr) {
      throw new Error(`SELECT permits failed for ${permitNumber}: ${selErr.message}`);
    }

    const wasInsert = !existing;

    const upsertPayload = {
      permit_number: permitNumber,
      applicant_name: applicantName,
      address,
      city: city.name,
      state: city.state,
      phone: enrichment?.phone || null,
      email: enrichment?.email || null,
      work_type: workType,
      permit_date: finalPermitDate,
      application_date: finalApplicationDate,
      estimated_value: enrichment?.estimated_value || null,
      status_source: statusSource,
      source_url: sourceUrl,
      description: finalDescription,
      raw_data: rawData,
    };

    const { error: upErr } = await supabase
      .from("permits")
      .upsert(upsertPayload, { onConflict: "permit_number" });

    if (upErr) {
      throw new Error(`UPSERT permits failed for ${permitNumber}: ${upErr.message}`);
    }

    if (wasInsert) result.inserted += 1;
    else result.updated += 1;
  }

  // Atualiza last_run da cidade
  await supabase
    .from("cities_config")
    .update({ last_run: new Date().toISOString() })
    .eq("id", city.id);

  return result;
}

// ---------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------

serve(async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-scraper-secret",
      },
    });
  }

  // Validação opcional de shared secret
  const expectedSecret = Deno.env.get("SCRAPER_SECRET");
  if (expectedSecret) {
    const got = req.headers.get("X-Scraper-Secret");
    if (got !== expectedSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Body opcional
  let citySlugFilter: string | null = null;
  let daysBackOverride: number | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.city_slug && typeof body.city_slug === "string") {
        citySlugFilter = body.city_slug.toLowerCase().trim();
      }
      if (typeof body?.days_back === "number" && body.days_back > 0) {
        daysBackOverride = body.days_back;
      }
    } catch {
      // body vazio ou inválido — ok
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Busca cidades active=true platform='permiteyes'
  const { data: cities, error: citiesErr } = await supabase
    .from("cities_config")
    .select("id, name, state, platform, base_url, parser_name, active, last_run")
    .eq("platform", "permiteyes")
    .eq("active", true);

  if (citiesErr) {
    return new Response(
      JSON.stringify({ ok: false, error: `cities_config query failed: ${citiesErr.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let targetCities: CityConfig[] = (cities ?? []) as CityConfig[];

  if (citySlugFilter) {
    targetCities = targetCities.filter((c) => slugFromBaseUrl(c.base_url) === citySlugFilter);
    if (targetCities.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Nenhuma cidade ativa com slug='${citySlugFilter}' (platform=permiteyes, active=true).`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const response: RunResponse = {
    ok: true,
    by_city: {},
    errors: [],
    duration_ms: 0,
  };

  for (const city of targetCities) {
    const daysBack = daysBackOverride ??
      (city.last_run ? DEFAULT_SUBSEQUENT_DAYS : DEFAULT_FIRST_RUN_DAYS);

    try {
      const cityResult = await scrapeCity(supabase, city, daysBack);
      response.by_city[city.name] = cityResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[scrape-permiteyes] ${city.name} falhou:`, msg);
      response.errors.push({ city: city.name, error: msg });
    }
  }

  response.duration_ms = Date.now() - startedAt;

  if (response.errors.length === targetCities.length && targetCities.length > 0) {
    response.ok = false;
  }

  return new Response(JSON.stringify(response), {
    status: response.ok ? 200 : 500,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
