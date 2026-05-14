#!/usr/bin/env python3
"""Scraper local de Cohasset PermitEyes — gera JSON pronto pro frontend consumir.

Cohasset usa PermitEyes igual a Hingham/Braintree/Hanson, MAS:
- A home page é publicview.php (não buildingpublichome.php)
- AJAX usa POST (não GET)
- Precisa de cookie de sessão obtido em publicview.php
- DataTables exige columns[i] completos no payload
- Lista DataTable tem só 12 colunas — enriquece via residential_controller.php

Uso:
    python3 tools/scrape-cohasset-local.py            # 45 dias (1a execução)
    python3 tools/scrape-cohasset-local.py --days 15  # cron subsequente
"""
import argparse
import http.cookiejar
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
OUTPUT = ROOT / "app" / "src" / "lib" / "cohasset-real.json"

BASE = "https://permiteyes.us/cohasset"
HOME_URL = f"{BASE}/publicview.php"
AJAX_URL = f"{BASE}/ajax/getbuildingpublichome.php"
DETAIL_URL = f"{BASE}/building/controller/residential_controller.php"
PAGE_SIZE = 500
DETAIL_THROTTLE_S = 0.25

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Safari/537.36")

# Cols Cohasset (12 cols, layout reduzido vs Hingham):
COL_HTML_VIEW = 0   # contém data-application-id
COL_DATE = 4        # ApplDate (mm/dd/yy)
COL_ADDRESS = 6
COL_APPLICANT = 7
COL_TYPE = 8        # RESI./COMM./ELECT./PLUMB./GAS/SIGN
COL_STATUS = 10


def make_opener():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [("User-Agent", UA)]
    return opener


def warm_session(opener):
    """GET publicview.php pra setar PHPSESSID."""
    req = urllib.request.Request(HOME_URL)
    with opener.open(req, timeout=30) as r:
        r.read()


def build_datatables_payload(start, length):
    base = {
        "draw": "1",
        "start": str(start),
        "length": str(length),
        "order[0][column]": "0",
        "order[0][dir]": "desc",
        "search[value]": "",
        "search[regex]": "false",
    }
    for i in range(12):
        base[f"columns[{i}][data]"] = str(i)
        base[f"columns[{i}][name]"] = ""
        base[f"columns[{i}][searchable]"] = "true"
        base[f"columns[{i}][orderable]"] = "true"
        base[f"columns[{i}][search][value]"] = ""
        base[f"columns[{i}][search][regex]"] = "false"
    return urllib.parse.urlencode(base).encode()


def fetch_list(opener):
    body = build_datatables_payload(0, PAGE_SIZE)
    req = urllib.request.Request(
        AJAX_URL,
        data=body,
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": HOME_URL,
        },
        method="POST",
    )
    with opener.open(req, timeout=60) as r:
        data = json.load(r)
    rows = data.get("data", [])
    total = data.get("recordsTotal", "?")
    print(f"[ok] {len(rows)} permits returned (of {total} total in Cohasset)")
    return rows


def fetch_detail(opener, application_id):
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
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Referer": HOME_URL,
            },
            method="POST",
        )
        with opener.open(req, timeout=20) as r:
            return json.loads(r.read())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        print(f"[warn] detail fetch failed for {application_id[:8]}...: {e}", file=sys.stderr)
        return None


def clean_html(s):
    if not isinstance(s, str):
        return s
    cleaned = re.sub(r"<[^>]+>", "", s).strip()
    return re.sub(r"\s+", " ", cleaned)


def extract_data_attrs(html):
    if not isinstance(html, str):
        return (None, None)
    app_m = re.search(r'data-application-id=["\']([a-f0-9-]+)["\']', html)
    perm_m = re.search(r'data-permit-id=["\']([a-f0-9-]+)["\']', html)
    return (app_m.group(1) if app_m else None,
            perm_m.group(1) if perm_m else None)


def parse_date_mmddyy(s):
    if not s:
        return None
    s = s.strip()
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if not m:
        return None
    mm, dd, yy = m.groups()
    yy = int(yy)
    if yy < 100:
        yy = 2000 + yy if yy < 50 else 1900 + yy
    return f"{yy:04d}-{int(mm):02d}-{int(dd):02d}"


def parse_date_iso(s):
    """Aceita 'YYYY-MM-DD' ou '0000-00-00' (vira None)."""
    if not s or s == "0000-00-00":
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    return parse_date_mmddyy(s)


def map_work_type(type_raw, description):
    text = f"{type_raw} {description}".lower()
    if any(k in text for k in [
        "new construction", "new home", "new single family",
        "new dwelling", "construct new", "new const", "newconst", "new house",
    ]):
        return "new_construction"
    if any(k in text for k in [
        "kitchen remodel", "kitchen renovation", "kitchen reno", "kitchen", "kit.",
    ]):
        return "kitchen_renovation"
    if any(k in text for k in [
        "bathroom remodel", "bath renovation", "bath remodel", "bathroom", "bath",
    ]):
        return "bath_renovation"
    if any(k in text for k in [
        "room addition", "garage addition", "second story addition", "addition", "add.",
    ]):
        return "addition"
    if any(k in text for k in [
        "interior renovation", "residential renovation", "commercial renovation",
        "basement remodel", "build-out", "build out", "tenant fit-out", "tenant fit out",
        "remodel", "alteration", "alter ", "renovation",
        "windows", "deck", "enclose", "porch", "siding", "reroof", "roofing", "roof",
    ]):
        return "renovation"
    if any(k in text for k in ["foundation permit", "foundation"]):
        return "foundation_permit"
    if any(k in text for k in ["building permit", "resi.", "comm."]):
        return "building_permit"
    return None


def is_status_closed(status):
    s = (status or "").lower()
    return ("closed" in s or "co issued" in s
            or "withdrawn" in s or "cancelled" in s
            or "denied" in s or "void" in s)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=45)
    args = parser.parse_args()

    cutoff_dt = (datetime.now(timezone.utc) - timedelta(days=args.days)).date()
    cutoff_iso = cutoff_dt.isoformat()
    print(f"[i] Cutoff: {cutoff_iso} (últimos {args.days} dias)")

    opener = make_opener()
    print("[i] Warming session...")
    warm_session(opener)

    print(f"[i] Fetching list (length={PAGE_SIZE})...")
    rows = fetch_list(opener)

    now_iso = datetime.now(timezone.utc).isoformat()
    out = []
    stats = {"too_old": 0, "no_date": 0, "not_relevant": 0, "closed": 0,
             "no_address": 0, "no_app_id": 0, "qualified": 0}

    # Filtra cedo por data ANTES de fazer enriquecimento (economia de requests)
    quick_filtered = []
    for row in rows:
        date_iso = parse_date_mmddyy(clean_html(row[COL_DATE]))
        if not date_iso:
            stats["no_date"] += 1
            continue
        if date_iso < cutoff_iso:
            stats["too_old"] += 1
            continue
        quick_filtered.append((row, date_iso))

    print(f"[i] {len(quick_filtered)} permits inside window. Enriching with detail...")

    for idx, (row, list_date_iso) in enumerate(quick_filtered, 1):
        app_id, perm_uuid = extract_data_attrs(row[COL_HTML_VIEW])
        if not app_id:
            stats["no_app_id"] += 1
            continue

        detail = fetch_detail(opener, app_id)
        time.sleep(DETAIL_THROTTLE_S)
        if idx % 25 == 0:
            print(f"  [{idx}/{len(quick_filtered)}] enriched...")

        # Detail é flat dict (não wrapped em "Application")
        app = detail or {}

        # Descrição da obra (campo mais útil pra classificar work_type)
        description = (app.get("BriefDescription") or "").strip()
        type_raw = clean_html(row[COL_TYPE])

        wt = map_work_type(type_raw, description)
        if wt is None:
            stats["not_relevant"] += 1
            continue

        status_raw = clean_html(row[COL_STATUS])
        if is_status_closed(status_raw):
            stats["closed"] += 1
            continue

        # Address: prefere detail SiteAddress (mais limpo)
        site_addr = (app.get("SiteAddress") or "").strip()
        list_addr = clean_html(row[COL_ADDRESS])
        address = site_addr.title() if site_addr else (list_addr.title() if list_addr else "")
        if not address:
            stats["no_address"] += 1
            continue

        # Datas
        appl_date = parse_date_iso(app.get("ApplDate") or "")
        issue_date = parse_date_iso(app.get("IssueDate") or "")
        permit_date = issue_date or appl_date or list_date_iso

        # Permit number (pode estar vazio em pending)
        permit_number = (app.get("PermitNumber") or "").strip()
        if not permit_number:
            # Build a partir de prefix+autoincre se vazio
            prefix = (app.get("AutoIncrePrefix") or "").strip()
            auto_id = (app.get("AutoIncreId") or "").strip()
            if prefix and auto_id:
                permit_number = f"{prefix}{auto_id}"
            else:
                permit_number = f"COH-{permit_date}-{address[:15].replace(' ', '')}"

        applicant_name = (app.get("AppName") or "").strip().title() or None
        owner_name = (app.get("OwnerName") or "").strip().title() or None

        app_phone = (app.get("AppPhone") or "").strip()
        owner_phone = (app.get("OwnerPhone") or "").strip()
        # filtra phones placeholder
        for p in (app_phone, owner_phone):
            if p and p not in ("000-000-0000", "0000000000", "(000) 000-0000"):
                phone = p
                break
        else:
            phone = None

        app_email = (app.get("AppEmail") or "").strip()
        owner_email = (app.get("OwnerEmail") or "").strip()
        # filtra emails placeholder do staff
        def real_email(e):
            return e and not e.lower().endswith("@hingham-ma.gov") and "@" in e
        email = (app_email if real_email(app_email)
                 else owner_email if real_email(owner_email)
                 else None)

        cost_raw = app.get("EstimatedCost")
        estimated_value = None
        if cost_raw not in (None, "", "0"):
            try:
                estimated_value = float(str(cost_raw).replace(",", "").replace("$", ""))
            except (ValueError, TypeError):
                pass

        source_url = (f"{BASE}/building/residentialview.php"
                      f"?application_id={app_id}&permit_id={perm_uuid}"
                      if app_id and perm_uuid else HOME_URL)

        permit = {
            "id": str(uuid.uuid4()),
            "permit_number": permit_number,
            "applicant_name": applicant_name,
            "address": address,
            "city": "Cohasset",
            "state": "MA",
            "phone": phone,
            "email": email,
            "work_type": wt,
            "permit_date": permit_date,
            "application_date": appl_date,
            "estimated_value": estimated_value,
            "status_source": status_raw if status_raw else None,
            "source_url": source_url,
            "description": description if description else None,
            "raw_data": {
                "source": "cohasset-permiteyes-direct",
                "type_raw": type_raw,
                "owner_name": owner_name,
                "map_block_lot": (app.get("MapBlockLot") or "").strip() or None,
                "zone": (app.get("Zone") or "").strip() or None,
                "application_id": app_id,
                "permit_uuid": perm_uuid,
                "auto_incre_id": (app.get("AutoIncreId") or "").strip() or None,
            },
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        out.append(permit)
        stats["qualified"] += 1

    print(f"\n[stats] {stats}")

    out.sort(key=lambda p: p["permit_date"] or "1900-01-01", reverse=True)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    by_type = {}
    for p in out:
        by_type[p["work_type"]] = by_type.get(p["work_type"], 0) + 1
    print(f"[ok] wrote {len(out)} permits to {OUTPUT}")
    print(f"[i] by work_type: {by_type}")


if __name__ == "__main__":
    main()
