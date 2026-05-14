#!/usr/bin/env python3
"""Scraper PermitEyes genérico — para cidades que abrem publicview.php sem login.

Funciona pra qualquer cidade no PermitEyes desde que:
1. publicview.php seja acessível sem login (redireciona pra login = nao serve)
2. tem endpoint /ajax/getbuildingpublichome.php
3. detail endpoint /building/controller/residential_controller.php funciona

Uso:
    python3 tools/scrape-permiteyes-generic.py <slug> <City Display Name> [--days 45] [--cols N]

Exemplo:
    python3 tools/scrape-permiteyes-generic.py rockland Rockland --days 60
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
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
PAGE_SIZE = 500
DETAIL_THROTTLE_S = 0.2

# Config por cidade — cada PermitEyes tem layout diferente.
CITY_CONFIGS = {
    "cohasset":     {"date": 4, "address": 6, "applicant": 7, "type": 8, "status": 10},
    "avon":         {"date": 4, "address": 6, "applicant": 7, "type": 8, "status": 10},
    "rockland":     {"address": 1, "description": 3, "date": 7, "applicant": 9, "type": 10, "status": 11},
    "stoughton":    {"date": 8, "address_num": 10, "address_street": 11, "applicant": 12, "type": 13, "status": 15},
    "braintree":    {"date": 6, "applicant": 8, "address": 9, "type": 10, "status": 11},
    "northreading": {"date": 4, "address": 6, "applicant": 7, "type": 8, "status": 10},
    "randolph":     {"date": 3, "address": 5, "applicant": 6, "description": 7, "type": 8, "status": 10},
    "hanson":       {"date": 6, "address": 8, "applicant": 9, "description": 11, "type": 12, "status": 14},
}


def make_opener():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [("User-Agent", UA)]
    return opener


def warm_session(opener, base):
    req = urllib.request.Request(f"{base}/publicview.php")
    with opener.open(req, timeout=30) as r:
        r.read()


def build_payload(start, length, num_cols):
    base = {
        "draw": "1", "start": str(start), "length": str(length),
        "order[0][column]": "0", "order[0][dir]": "desc",
        "search[value]": "", "search[regex]": "false",
    }
    for i in range(num_cols):
        base[f"columns[{i}][data]"] = str(i)
        base[f"columns[{i}][searchable]"] = "true"
        base[f"columns[{i}][orderable]"] = "true"
        base[f"columns[{i}][search][value]"] = ""
        base[f"columns[{i}][search][regex]"] = "false"
    return urllib.parse.urlencode(base).encode()


def fetch_list(opener, base, num_cols):
    body = build_payload(0, PAGE_SIZE, num_cols)
    req = urllib.request.Request(
        f"{base}/ajax/getbuildingpublichome.php",
        data=body,
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": f"{base}/publicview.php",
        }, method="POST",
    )
    with opener.open(req, timeout=60) as r:
        return json.load(r)


def fetch_detail(opener, base, app_id):
    if not app_id:
        return None
    try:
        body = urllib.parse.urlencode({"action": "view", "ApplicationId": app_id}).encode()
        req = urllib.request.Request(
            f"{base}/building/controller/residential_controller.php",
            data=body,
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Referer": f"{base}/publicview.php",
            }, method="POST",
        )
        with opener.open(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"[warn] detail {app_id[:8]}: {e}", file=sys.stderr)
        return None


def clean_html(s):
    if not isinstance(s, str):
        return s
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def extract_ids(html):
    if not isinstance(html, str):
        return (None, None)
    a = re.search(r'data-application-id=["\']([a-f0-9-]+)["\']', html)
    p = re.search(r'data-permit-id=["\']([a-f0-9-]+)["\']', html)
    return (a.group(1) if a else None, p.group(1) if p else None)


def parse_date(s):
    if not s or s == "0000-00-00":
        return None
    s = s.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if not m:
        return None
    mm, dd, yy = m.groups()
    yy = int(yy)
    if yy < 100:
        yy = 2000 + yy if yy < 50 else 1900 + yy
    return f"{yy:04d}-{int(mm):02d}-{int(dd):02d}"


def map_work_type(type_raw, description):
    text = f"{type_raw} {description}".lower()
    if any(k in text for k in ["new construction", "new home", "new single family",
                                "new dwelling", "construct new", "new const", "newconst", "new house"]):
        return "new_construction"
    if any(k in text for k in ["kitchen remodel", "kitchen renovation", "kitchen reno", "kitchen", "kit."]):
        return "kitchen_renovation"
    if any(k in text for k in ["bathroom remodel", "bath renovation", "bath remodel", "bathroom", "bath"]):
        return "bath_renovation"
    if any(k in text for k in ["room addition", "garage addition", "second story addition", "addition", "add."]):
        return "addition"
    if any(k in text for k in ["interior renovation", "residential renovation", "commercial renovation",
                                "basement remodel", "build-out", "build out", "tenant fit-out", "tenant fit out",
                                "remodel", "alteration", "alter ", "renovation",
                                "windows", "deck", "enclose", "porch", "siding", "reroof", "roofing", "roof"]):
        return "renovation"
    if any(k in text for k in ["foundation permit", "foundation"]):
        return "foundation_permit"
    if any(k in text for k in ["building permit", "resi.", "comm.", "build"]):
        return "building_permit"
    return None


def is_closed(status):
    s = (status or "").lower()
    return any(k in s for k in ["closed", "co issued", "withdrawn", "cancelled", "denied", "void"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("slug", help="ex: rockland, avon, stoughton")
    parser.add_argument("name", help="Nome de exibição da cidade")
    parser.add_argument("--days", type=int, default=45)
    args = parser.parse_args()

    slug = args.slug
    base = f"https://permiteyes.us/{slug}"
    output = ROOT / "app" / "src" / "lib" / f"{slug}-real.json"

    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).date().isoformat()
    print(f"[i] {args.name} — cutoff {cutoff}")

    opener = make_opener()
    warm_session(opener, base)

    # Detecta n_cols com 1 request mínimo
    sample_payload = build_payload(0, 1, 20)  # tenta com 20 (cobre 12/17)
    req = urllib.request.Request(
        f"{base}/ajax/getbuildingpublichome.php",
        data=sample_payload,
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": f"{base}/publicview.php",
        }, method="POST",
    )
    try:
        with opener.open(req, timeout=30) as r:
            sample = json.load(r)
        n_cols = len(sample.get("data", [[]])[0]) if sample.get("data") else 12
    except Exception:
        n_cols = 12

    print(f"[i] Detected {n_cols} cols")
    if slug not in CITY_CONFIGS:
        print(f"[!] Cidade '{slug}' não tem config mapeado. Edite CITY_CONFIGS.")
        sys.exit(2)
    layout = CITY_CONFIGS[slug]

    print(f"[i] Fetching {PAGE_SIZE} permits...")
    data = fetch_list(opener, base, n_cols)
    rows = data.get("data", [])
    print(f"[ok] {len(rows)} returned (of {data.get('recordsTotal','?')} total)")

    # Pre-filter por data
    in_window = []
    skipped_old = 0
    for row in rows:
        max_col = max(v for k, v in layout.items() if isinstance(v, int))
        if not row or len(row) <= max_col:
            continue
        d = parse_date(clean_html(row[layout["date"]]))
        if not d:
            continue
        if d < cutoff:
            skipped_old += 1
            continue
        in_window.append((row, d))
    print(f"[i] {len(in_window)} permits in window. Enriching...")

    now_iso = datetime.now(timezone.utc).isoformat()
    out = []
    stats = {"old": skipped_old, "not_relevant": 0, "closed": 0, "no_addr": 0, "no_id": 0, "ok": 0}

    for idx, (row, list_date) in enumerate(in_window, 1):
        app_id, perm_uuid = extract_ids(row[0])
        if not app_id:
            stats["no_id"] += 1
            continue

        detail = fetch_detail(opener, base, app_id) or {}
        time.sleep(DETAIL_THROTTLE_S)
        if idx % 25 == 0:
            print(f"  [{idx}/{len(in_window)}]")

        description = (detail.get("BriefDescription") or "").strip() if isinstance(detail, dict) else ""
        if not description and "description" in layout:
            description = clean_html(row[layout["description"]])

        type_raw = clean_html(row[layout["type"]])
        wt = map_work_type(type_raw, description)
        if wt is None:
            stats["not_relevant"] += 1
            continue

        status_raw = clean_html(row[layout["status"]])
        if is_closed(status_raw):
            stats["closed"] += 1
            continue

        site_addr = (detail.get("SiteAddress") or "").strip() if isinstance(detail, dict) else ""
        if "address" in layout:
            list_addr = clean_html(row[layout["address"]])
        elif "address_num" in layout and "address_street" in layout:
            num = clean_html(row[layout["address_num"]])
            street = clean_html(row[layout["address_street"]])
            list_addr = f"{num} {street}".strip()
        else:
            list_addr = ""
        addr = site_addr.title() if site_addr else (list_addr.title() if list_addr else "")
        if not addr:
            stats["no_addr"] += 1
            continue

        appl_date = parse_date(detail.get("ApplDate", "")) if isinstance(detail, dict) else None
        issue_date = parse_date(detail.get("IssueDate", "")) if isinstance(detail, dict) else None
        permit_date = issue_date or appl_date or list_date

        permit_num = (detail.get("PermitNumber", "") if isinstance(detail, dict) else "").strip()
        if not permit_num:
            prefix = (detail.get("AutoIncrePrefix", "") if isinstance(detail, dict) else "").strip()
            auto_id = (detail.get("AutoIncreId", "") if isinstance(detail, dict) else "").strip()
            if prefix and auto_id:
                permit_num = f"{prefix}{auto_id}"
            else:
                permit_num = f"{slug.upper()}-{permit_date}-{addr[:15].replace(' ', '')}"

        applicant = ((detail.get("AppName", "") if isinstance(detail, dict) else "").strip().title()
                     or clean_html(row[layout["applicant"]]).title() or None)

        app_phone = (detail.get("AppPhone", "") if isinstance(detail, dict) else "").strip()
        owner_phone = (detail.get("OwnerPhone", "") if isinstance(detail, dict) else "").strip()
        phone = None
        for p in (app_phone, owner_phone):
            if p and p not in ("000-000-0000", "0000000000", "(000) 000-0000"):
                phone = p
                break

        def real_email(e):
            return e and "@" in e and not e.lower().endswith(("@hingham-ma.gov", "@gmail.com.example"))
        app_email = (detail.get("AppEmail", "") if isinstance(detail, dict) else "").strip()
        owner_email = (detail.get("OwnerEmail", "") if isinstance(detail, dict) else "").strip()
        email = app_email if real_email(app_email) else (owner_email if real_email(owner_email) else None)

        cost = None
        cost_raw = detail.get("EstimatedCost") if isinstance(detail, dict) else None
        if cost_raw not in (None, "", "0"):
            try:
                cost = float(str(cost_raw).replace(",", "").replace("$", ""))
            except (ValueError, TypeError):
                pass

        source_url = (f"{base}/building/residentialview.php"
                      f"?application_id={app_id}&permit_id={perm_uuid}"
                      if app_id and perm_uuid else f"{base}/publicview.php")

        out.append({
            "id": str(uuid.uuid4()),
            "permit_number": permit_num,
            "applicant_name": applicant,
            "address": addr,
            "city": args.name,
            "state": "MA",
            "phone": phone,
            "email": email,
            "work_type": wt,
            "permit_date": permit_date,
            "application_date": appl_date,
            "estimated_value": cost,
            "status_source": status_raw or None,
            "source_url": source_url,
            "description": description or None,
            "raw_data": {
                "source": f"{slug}-permiteyes-direct",
                "type_raw": type_raw,
                "owner_name": ((detail.get("OwnerName", "") if isinstance(detail, dict) else "").strip().title() or None),
                "application_id": app_id,
                "permit_uuid": perm_uuid,
            },
            "created_at": now_iso,
            "updated_at": now_iso,
        })
        stats["ok"] += 1

    print(f"\n[stats] {stats}")
    out.sort(key=lambda p: p["permit_date"] or "1900-01-01", reverse=True)

    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    by_type = {}
    for p in out:
        by_type[p["work_type"]] = by_type.get(p["work_type"], 0) + 1
    print(f"[ok] wrote {len(out)} permits to {output}")
    print(f"[i] by work_type: {by_type}")


if __name__ == "__main__":
    main()
