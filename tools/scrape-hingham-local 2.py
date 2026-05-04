#!/usr/bin/env python3
"""
Scraper local de Hingham PermitEyes — gera JSON pronto pro frontend consumir.

DESCOBERTA 03/mai 14h: o endpoint é DataTables server-side com paginação.
Hingham tem 53.562 permits totais. Usando order[0][column]=6&order[0][dir]=desc
pega os mais recentes primeiro. 200 permits cobrem ~17 dias.

Janela:
- Primeira execução: pega últimos 45 dias
- Próximas execuções (cron 15d): pega últimos 15 dias
- UNIQUE em permit_number garante idempotência (sem duplicar)

Output: app/src/lib/hingham-real.json no formato Permit[] (CONTRACTS.md).

Uso:
    python3 tools/scrape-hingham-local.py          # default: 45 dias (primeira)
    python3 tools/scrape-hingham-local.py --days 15  # cron subsequente

Sem dependências externas (só stdlib).
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "app" / "src" / "lib" / "hingham-real.json"

# Endpoint DataTables server-side. Suporta paginação + ordering.
# col[6] = IssueDate (data de emissão). desc = mais recentes primeiro.
URL = "https://permiteyes.us/hingham/ajax/getbuildingpublichome.php"
PAGE_SIZE = 500  # 500 permits ordenados desc cobre ~30-45 dias em Hingham (alto volume)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
}


def clean_html(s):
    """Remove tags HTML e espaços extras de uma célula."""
    if not isinstance(s, str):
        return s
    cleaned = re.sub(r"<[^>]+>", "", s).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def extract_data_attrs(html):
    """Extrai data-application-id e data-permit-id de col[0]/col[1] (HTML de botão).

    PermitEyes embute UUIDs nos attributes data-* dos links de view.
    Retorna (application_id, permit_id) ou (None, None).
    """
    if not isinstance(html, str):
        return (None, None)
    app_match = re.search(r'data-application-id=["\']([a-f0-9-]+)["\']', html)
    perm_match = re.search(r'data-permit-id=["\']([a-f0-9-]+)["\']', html)
    return (
        app_match.group(1) if app_match else None,
        perm_match.group(1) if perm_match else None,
    )


def parse_date_mmddyy(s):
    """Converte '01/03/23' em '2023-01-03' (ISO). Assume 20YY se YY < 50."""
    if not s:
        return None
    s = s.strip()
    try:
        m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
        if not m:
            return None
        mm, dd, yy = m.groups()
        yy_int = int(yy)
        if yy_int < 100:
            yy_int = 2000 + yy_int if yy_int < 50 else 1900 + yy_int
        return f"{yy_int:04d}-{int(mm):02d}-{int(dd):02d}"
    except Exception:
        return None


def map_work_type(type_raw, description_raw):
    """Heurística pro work_type usando palavras-chave do Reginaldo (03/mai).

    Retorna uma das 7 categorias OU None (= SKIP, permit não relevante).

    Ordem importa: new_construction > kitchen > bath > addition > renovation >
    foundation > building.
    """
    text = (type_raw or "").lower()
    desc = (description_raw or "").lower()
    combined = f"{text} {desc}"

    # NEW CONSTRUCTION (mais específico primeiro)
    if any(k in combined for k in [
        "new construction", "new home", "new single family",
        "new dwelling", "construct new", "new const", "n.c.",
        "newconst", "new house",
    ]):
        return "new_construction"

    # KITCHEN
    if any(k in combined for k in [
        "kitchen remodel", "kitchen renovation", "kitchen reno",
        "kitchen", "kit.",
    ]):
        return "kitchen_renovation"

    # BATH
    if any(k in combined for k in [
        "bathroom remodel", "bath renovation", "bath remodel",
        "bathroom", "bath",
    ]):
        return "bath_renovation"

    # ADDITION (todas variantes)
    if any(k in combined for k in [
        "room addition", "garage addition", "second story addition",
        "addition", "add.",
    ]):
        return "addition"

    # RENOVATION genérica (depois de kitchen/bath/addition)
    if any(k in combined for k in [
        "interior renovation", "residential renovation",
        "commercial renovation", "basement remodel", "build-out",
        "build out", "tenant fit-out", "tenant fit out",
        "remodel", "alteration", "alter ", "renovation",
    ]):
        return "renovation"

    # FOUNDATION
    if any(k in combined for k in [
        "foundation permit", "foundation",
    ]):
        return "foundation_permit"

    # BUILDING PERMIT genérico (último — RESI./COMM/Building Permit sem desc específica)
    if any(k in combined for k in [
        "building permit", "resi.", "comm.",
    ]):
        return "building_permit"

    # Não bate em nenhuma das 7 categorias → SKIP (PLUMB., GAS, ELEC., SIGN, etc)
    return None


DETAIL_URL = "https://permiteyes.us/hingham/building/controller/residential_controller.php"
DETAIL_THROTTLE_S = 0.25  # 250ms entre requests pra não derrubar o servidor


def fetch_permit_detail(application_id):
    """Fetch detalhe individual via endpoint POST que popula a view residencial.

    Retorna dict com Application/Residential/ApplicationContractor/etc keys.
    Retorna None em caso de erro (não trava o scrape inteiro).
    """
    if not application_id:
        return None
    try:
        body = urllib.parse.urlencode({
            "action": "view",
            "ApplicationId": application_id,
        }).encode()
        req = urllib.request.Request(
            DETAIL_URL,
            data=body,
            headers={
                **HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        print(f"[warn] detail fetch failed for {application_id[:8]}...: {e}", file=sys.stderr)
        return None


def enrich_with_detail(permit, application_id):
    """Faz fetch do detalhe e enriquece o permit com phone/email/value/endereço completo."""
    detail = fetch_permit_detail(application_id)
    if not detail or "Application" not in detail:
        return permit

    app = detail.get("Application", {})

    # Endereço completo (sobrescreve se vier melhor que o da home)
    site_num = (app.get("SiteStNum") or "").strip()
    site_street = (app.get("SiteStName") or "").strip()
    if site_street:
        addr = f"{site_num} {site_street}".strip().title()
        permit["address"] = addr

    # Phone / email do applicant (preferência) ou owner como fallback
    app_phone = (app.get("AppPhone") or "").strip()
    app_email = (app.get("AppEmail") or "").strip()
    owner_phone = (app.get("OwnerPhone") or "").strip()
    owner_email = (app.get("OwnerEmail") or "").strip()

    permit["phone"] = app_phone or owner_phone or None
    permit["email"] = app_email or owner_email or None

    # Valor estimado
    cost_raw = app.get("EstimatedCost")
    if cost_raw not in (None, "", "0"):
        try:
            permit["estimated_value"] = float(str(cost_raw).replace(",", "").replace("$", ""))
        except (ValueError, TypeError):
            pass

    # Applicant name mais limpo (vem como "Kevin Green" no detalhe vs lowercase na home)
    app_name = (app.get("AppName") or "").strip()
    if app_name:
        permit["applicant_name"] = app_name

    # BriefDescription: campo COMPLETO da obra (vs col[12] da home que vem truncado)
    brief = (app.get("BriefDescription") or "").strip()
    if brief:
        permit["description"] = brief

    # IssueDate (sobrescreve permit_date — mais confiável que col[6] da home)
    issue_date = (app.get("IssueDate") or "").strip()
    if issue_date and issue_date != "0000-00-00":
        permit["permit_date"] = issue_date

    # ApplDate (data que o cidadão pediu o permit)
    appl_date = (app.get("ApplDate") or "").strip()
    if appl_date and appl_date != "0000-00-00":
        permit["application_date"] = appl_date

    # Owner separado (campo novo no raw_data pra futuro)
    owner_name = (app.get("OwnerName") or "").strip()
    permit["raw_data"]["owner_name"] = owner_name.title() if owner_name else None
    permit["raw_data"]["map_block_lot"] = (app.get("MapBlockLot") or "").strip() or None
    permit["raw_data"]["zone"] = (app.get("Zone") or "").strip() or None

    # Área da obra em sq ft (Residential section)
    res = detail.get("Residential", {}) or {}
    sq_area = res.get("SquareAreaWork")
    if sq_area and str(sq_area).strip() not in ("", "0"):
        try:
            permit["raw_data"]["square_area_work"] = int(sq_area)
        except (ValueError, TypeError):
            pass

    return permit


def fetch_hingham():
    """Busca permits ordenados por IssueDate DESC (mais recentes primeiro)."""
    params = {
        "draw": "1",
        "start": "0",
        "length": str(PAGE_SIZE),
        "order[0][column]": "6",  # col 6 = IssueDate
        "order[0][dir]": "desc",
    }
    qs = urllib.parse.urlencode(params)
    full_url = f"{URL}?{qs}"
    print(f"[i] Fetching {URL} (length={PAGE_SIZE}, order=IssueDate desc)...")
    req = urllib.request.Request(full_url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    rows = data.get("data", [])
    total = data.get("recordsTotal", "?")
    print(f"[ok] {len(rows)} permits returned (of {total} total in Hingham)")
    return rows


def transform(rows, cutoff_date=None):
    """Transforma rows brutos em Permit[]. Filtra por cutoff_date (data ISO).

    Permits com data anterior ao cutoff são descartados.
    Permits sem data ou com data ilegível também (não dá pra confiar).
    """
    out = []
    skipped_no_perm_number = 0
    skipped_not_relevant = 0
    skipped_too_old = 0
    skipped_no_date = 0
    skipped_malformed = 0
    skipped_closed = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    for row in rows:
        if not isinstance(row, list) or len(row) < 17:
            skipped_malformed += 1
            continue

        # Extrair UUIDs ANTES de cleanar HTML (precisa do markup pra regex)
        application_id, permit_uuid = extract_data_attrs(row[0])
        if not (application_id and permit_uuid):
            # fallback: tentar col[1]
            application_id, permit_uuid = extract_data_attrs(row[1])

        cols = [clean_html(c) if isinstance(c, str) else c for c in row]

        permit_number = (cols[14] or "").strip()
        if not permit_number:
            skipped_no_perm_number += 1
            continue

        # Janela temporal: aplica cutoff se setado
        date_iso = parse_date_mmddyy(cols[6] or cols[5])
        if cutoff_date is not None:
            if not date_iso:
                skipped_no_date += 1
                continue
            if date_iso < cutoff_date:
                skipped_too_old += 1
                continue

        number = (cols[8] or "").strip()
        street = (cols[9] or "").strip()
        description = (cols[12] or "").strip()

        # Filtra: só 7 categorias relevantes pro Reginaldo
        wt = map_work_type(cols[13], description)
        if wt is None:
            skipped_not_relevant += 1
            continue

        # Filtra: skip permits com obra finalizada (closed / CO issued)
        # Decisão Fábio 03/mai: closed = obra terminada = lead morto, não faz sentido
        status_raw = (cols[15] or "").lower()
        if "closed" in status_raw or "co issued" in status_raw:
            skipped_closed += 1
            continue

        # Address: tenta number+street; fallback pra "Hingham, MA"
        if street:
            address = f"{number} {street}".strip().title()
        else:
            address = "Hingham, MA"

        applicant = (cols[10] or "").strip() or (cols[11] or "").strip()
        owner = (cols[11] or "").strip()

        # URL do permit no portal — abre detalhe individual diretamente.
        # Validado 03/mai: residentialview.php é PÚBLICO em Hingham.
        if application_id and permit_uuid:
            permit_url = (
                f"https://permiteyes.us/hingham/building/residentialview.php"
                f"?application_id={application_id}"
                f"&permit_id={permit_uuid}"
            )
        else:
            # fallback: lista geral (caso UUIDs não venham)
            permit_url = "https://permiteyes.us/hingham/publicview.php"

        permit = {
            "id": str(uuid.uuid4()),
            "permit_number": permit_number,
            "applicant_name": applicant.title() if applicant else None,
            "address": address,
            "city": "Hingham",
            "state": "MA",
            "phone": None,
            "email": None,
            "work_type": wt,
            "permit_date": date_iso,
            "application_date": None,
            "estimated_value": None,
            "status_source": (cols[15] or None),
            "source_url": permit_url,
            "description": description if description else None,
            "raw_data": {
                "type_raw": cols[13],
                "permit_id_internal": cols[4],
                "owner_raw": owner,
                "applicant_raw": cols[10],
                "description": description,
                "address_complete": street != "",
                "application_id": application_id,
                "permit_uuid": permit_uuid,
            },
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        out.append(permit)

    print(
        f"[ok] {len(out)} permits transformed (active only) | "
        f"skipped: {skipped_too_old} too old, {skipped_not_relevant} not relevant, "
        f"{skipped_closed} closed/CO issued, "
        f"{skipped_no_perm_number} no_permit_number, {skipped_no_date} no_date"
    )
    return out


def main():
    parser = argparse.ArgumentParser(description="Scrape Hingham permits.")
    parser.add_argument(
        "--days", type=int, default=45,
        help="Janela em dias (default 45 pra primeira execução, 15 pro cron)",
    )
    args = parser.parse_args()

    cutoff_dt = (datetime.now(timezone.utc) - timedelta(days=args.days)).date()
    cutoff_iso = cutoff_dt.isoformat()
    print(f"[i] Cutoff: permits a partir de {cutoff_iso} (últimos {args.days} dias)")

    rows = fetch_hingham()
    permits = transform(rows, cutoff_date=cutoff_iso)

    # Enriquecimento: phone/email/value/endereço completo via detalhe individual
    print(f"[i] Enriching {len(permits)} permits with detail data (~{int(len(permits) * (DETAIL_THROTTLE_S + 0.4))}s)...")
    enriched = 0
    for i, p in enumerate(permits, 1):
        app_id = p["raw_data"].get("application_id")
        if not app_id:
            # extrair de algum lugar — se scraper não pôs em raw_data, pular
            continue
        enrich_with_detail(p, app_id)
        enriched += 1
        if i % 25 == 0:
            print(f"  [{i}/{len(permits)}] enriched...")
        time.sleep(DETAIL_THROTTLE_S)
    print(f"[ok] enriched {enriched} permits")

    permits.sort(
        key=lambda p: p["permit_date"] or "1900-01-01",
        reverse=True,
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(permits, f, indent=2, ensure_ascii=False)

    print(f"[ok] wrote {len(permits)} permits to {OUTPUT}")
    by_type = {}
    for p in permits:
        by_type[p["work_type"]] = by_type.get(p["work_type"], 0) + 1
    print(f"[i] by work_type: {by_type}")


if __name__ == "__main__":
    main()
