#!/usr/bin/env python3
"""Processa Somerville Open Data (Socrata) — building permits residenciais.

Dataset: nneb-s3f7 (Applications for Permits and Licenses)
Volume: 27.696 building permits totais, 332 últimos 60 dias.

API: https://data.somervillema.gov/resource/nneb-s3f7.json?<SoQL>
"""
import json
import re
import sys
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "app" / "src" / "lib" / "somerville-real.json"

API_URL = "https://data.somervillema.gov/resource/nneb-s3f7.json"


def map_work_type(subtype, description):
    text = f"{subtype} {description}".lower()
    if any(k in text for k in ["new construction", "new home", "new single family",
                                "new dwelling", "construct new", "new const"]):
        return "new_construction"
    if "kitchen" in text:
        return "kitchen_renovation"
    if any(k in text for k in ["bathroom", "bath remodel", "bath renovation"]):
        return "bath_renovation"
    if any(k in text for k in ["addition", "room addition", "garage addition"]):
        return "addition"
    if any(k in text for k in ["renovation", "remodel", "alteration", "repair",
                                "roofing", "roof", "siding", "windows", "deck",
                                "interior", "basement"]):
        return "renovation"
    if "foundation" in text:
        return "foundation_permit"
    if "building permit" in text or "residential" in text:
        return "building_permit"
    return None


def fetch_somerville(days_back=60):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)).date().isoformat()
    soql = (
        f"$where=application_type='Building Permit' AND application_date>'{cutoff}'"
        f"&$order=application_date DESC&$limit=500"
    )
    url = f"{API_URL}?{urllib.parse.quote(soql, safe='=&$')}"
    print(f"[i] Fetching Somerville (cutoff: {cutoff})...")
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())


def process(records):
    out = []
    skipped_not_relevant = skipped_closed = skipped_no_address = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for r in records:
        address = (r.get("application_address") or "").strip()
        if not address:
            skipped_no_address += 1
            continue

        subtype = (r.get("application_subtype") or "").strip()
        description = (r.get("project_description_or_business_name") or "").strip()
        wt = map_work_type(subtype, description)
        if wt is None:
            skipped_not_relevant += 1
            continue

        status = (r.get("status") or "").strip()
        if "closed" in status.lower() or "withdrawn" in status.lower() or "denied" in status.lower():
            skipped_closed += 1
            continue

        # Endereço limpo (remover ", SOMERVILLE MASSACHUSETTS XXXXX")
        addr_clean = re.sub(r",\s*SOMERVILLE\s+MASSACHUSETTS.*$", "", address, flags=re.IGNORECASE).strip().title()

        # Estimated value
        est_value = None
        cost = r.get("estimated_construction_cost") or r.get("application_amount")
        if cost:
            try:
                est_value = float(str(cost).replace(",", "").replace("$", ""))
                if est_value <= 0: est_value = None
            except (ValueError, TypeError): pass

        # Applicant: prefere contractor, fallback applicant_company
        applicant = (r.get("contractor_company") or r.get("applicant_company_name") or "").strip()

        permit = {
            "id": str(uuid.uuid4()),
            "permit_number": r.get("application_number", "").strip(),
            "applicant_name": applicant.title() if applicant else None,
            "address": addr_clean,
            "city": "Somerville",
            "state": "MA",
            "phone": None,
            "email": None,
            "work_type": wt,
            "permit_date": (r.get("issue_date") or r.get("application_date") or "")[:10],
            "application_date": (r.get("application_date") or "")[:10] or None,
            "estimated_value": est_value,
            "status_source": status if status else None,
            "source_url": "https://data.somervillema.gov/d/nneb-s3f7",
            "description": description if description else None,
            "raw_data": {
                "source": "somerville-socrata",
                "subtype": subtype,
                "neighborhood": r.get("application_neighborhood"),
                "ward": r.get("application_ward"),
                "parcel": r.get("parcel_number"),
                "lat": r.get("application_latitude"),
                "lng": r.get("application_longitude"),
            },
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        out.append(permit)

    print(f"[Somerville] {len(out)} qualified | "
          f"skipped: {skipped_not_relevant} not relevant, {skipped_closed} closed, {skipped_no_address} no_address | "
          f"total raw: {len(records)}")
    return out


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=60)
    args = parser.parse_args()
    records = fetch_somerville(days_back=args.days)
    permits = process(records)
    permits.sort(key=lambda p: p["permit_date"] or "1900-01-01", reverse=True)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(permits, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n[ok] {len(permits)} Somerville permits saved to {OUTPUT}")
    from collections import Counter
    by_type = Counter(p["work_type"] for p in permits)
    print(f"by_work_type: {dict(by_type)}")

    if permits:
        s = permits[0]
        print(f"\nSample (most recent):")
        print(f"  {s['permit_number']} - {s['address']}")
        print(f"  Applicant: {s['applicant_name']}")
        print(f"  Type: {s['work_type']}")
        print(f"  Value: ${s['estimated_value']:,.0f}" if s['estimated_value'] else "  Value: —")
        print(f"  Description: {(s['description'] or '')[:140]}")
        total = sum(p['estimated_value'] for p in permits if p['estimated_value'])
        print(f"\nTotal value: ${total:,.0f}")

if __name__ == "__main__":
    main()
