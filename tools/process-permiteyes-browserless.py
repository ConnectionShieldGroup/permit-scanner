#!/usr/bin/env python3
"""Processa JSONs do Browserless intercept das cidades PermitEyes.

Cada cidade tem layout de colunas diferente — config dict mapeia.

Saída: app/src/lib/<city>-real.json
"""
import json
import re
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = Path("/tmp")
OUTPUT_DIR = ROOT / "app" / "src" / "lib"

# Config por cidade — col_idx_map = posição da coluna pelo nome
CITY_CONFIG = {
    "braintree": {
        "name": "Braintree",
        "input": "bl-braintree-500.json",
        "cols": {"date": 6, "applicant": 8, "address": 9, "type": 10, "status": 11},
    },
    "northreading": {
        "name": "North Reading",
        "input": "bl-northreading-500.json",
        "cols": {"permit_num": 3, "date": 4, "address": 6, "applicant": 7, "type": 8, "status": 10},
    },
    "randolph": {
        "name": "Randolph",
        "input": "bl-randolph-500.json",
        "cols": {"permit_num": 2, "date": 3, "address": 5, "applicant": 6, "description": 7, "type": 8, "status": 10},
    },
    "hanson": {
        "name": "Hanson",
        "input": "bl-hanson-500.json",
        "cols": {"permit_num": 5, "date": 6, "address": 8, "applicant": 9, "owner": 10, "description": 11, "type": 12, "status": 14},
    },
}


def clean_html(s):
    if s is None: return ""
    return re.sub(r"<[^>]+>", "", str(s)).strip()


def extract_data_attrs(html):
    if not isinstance(html, str): return None, None
    app = re.search(r'data-application-id=["\']([a-f0-9-]+)["\']', html)
    perm = re.search(r'data-permit-id=["\']([a-f0-9-]+)["\']', html)
    return (app.group(1) if app else None, perm.group(1) if perm else None)


def parse_date_mmddyy(s):
    if not s: return None
    s = s.strip()
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if not m: return None
    mm, dd, yy = m.groups()
    yy = int(yy)
    if yy < 100: yy = 2000 + yy if yy < 50 else 1900 + yy
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
                                "rip and reroof", "reroof", "roofing", "roof", "siding",
                                "windows", "deck", "enclose", "porch"]):
        return "renovation"
    if any(k in text for k in ["foundation permit", "foundation"]):
        return "foundation_permit"
    if any(k in text for k in ["building permit", "resi.", "comm."]):
        return "building_permit"
    return None


def is_status_closed(status):
    s = (status or "").lower()
    return "closed" in s or "co issued" in s or "withdrawn" in s or "cancelled" in s


def process_city(slug, cfg, cutoff_date):
    input_path = INPUT_DIR / cfg["input"]
    if not input_path.exists():
        print(f"[skip] {input_path} não existe", file=sys.stderr)
        return []

    with open(input_path) as f:
        d = json.load(f)
    rows = d.get("data", {}).get("data", [])

    out = []
    skipped_old = skipped_not_relevant = skipped_no_address = skipped_closed = 0

    for row in rows:
        cols = cfg["cols"]
        date_raw = clean_html(row[cols["date"]])
        date_iso = parse_date_mmddyy(date_raw)
        if not date_iso or date_iso < cutoff_date:
            skipped_old += 1
            continue

        address = clean_html(row[cols["address"]])
        if not address:
            skipped_no_address += 1
            continue

        type_raw = clean_html(row[cols["type"]])
        description = clean_html(row[cols["description"]]) if "description" in cols else ""

        wt = map_work_type(type_raw, description)
        if wt is None:
            skipped_not_relevant += 1
            continue

        status = clean_html(row[cols["status"]])
        if is_status_closed(status):
            skipped_closed += 1
            continue

        applicant = clean_html(row[cols["applicant"]])
        owner = clean_html(row[cols["owner"]]) if "owner" in cols else ""
        permit_num = clean_html(row[cols["permit_num"]]) if "permit_num" in cols else ""
        if not permit_num:
            permit_num = f"{slug}-{date_iso}-{address[:20]}"

        # UUIDs pra source_url
        app_id, perm_uuid = extract_data_attrs(row[0]) or (None, None)
        if app_id and perm_uuid:
            source_url = (
                f"https://permiteyes.us/{slug}/building/residentialview.php"
                f"?application_id={app_id}&permit_id={perm_uuid}"
            )
        else:
            source_url = f"https://permiteyes.us/{slug}/publicview.php"

        permit = {
            "id": str(uuid.uuid4()),
            "permit_number": permit_num,
            "applicant_name": applicant.title() if applicant else None,
            "address": address.title(),
            "city": cfg["name"],
            "state": "MA",
            "phone": None,
            "email": None,
            "work_type": wt,
            "permit_date": date_iso,
            "application_date": None,
            "estimated_value": None,
            "status_source": status if status else None,
            "source_url": source_url,
            "description": description if description else None,
            "raw_data": {
                "source": f"{slug}-permiteyes-browserless",
                "type_raw": type_raw,
                "owner": owner if owner else None,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        out.append(permit)

    print(f"[{cfg['name']}] {len(out)} qualified | "
          f"skipped: {skipped_old} old, {skipped_not_relevant} not relevant, "
          f"{skipped_closed} closed, {skipped_no_address} no_address | total raw: {len(rows)}")

    if out:
        out_path = OUTPUT_DIR / f"{slug}-real.json"
        with open(out_path, "w") as f:
            json.dump(out, f, indent=2, ensure_ascii=False, default=str)
    return out


def main():
    cutoff_dt = (datetime.now(timezone.utc) - timedelta(days=45)).date()
    cutoff_iso = cutoff_dt.isoformat()
    print(f"Cutoff: {cutoff_iso} (últimos 45 dias)\n")

    grand_total = 0
    for slug, cfg in CITY_CONFIG.items():
        permits = process_city(slug, cfg, cutoff_iso)
        grand_total += len(permits)

    print(f"\n[total] {grand_total} permits qualified across {len(CITY_CONFIG)} cities")

if __name__ == "__main__":
    main()
