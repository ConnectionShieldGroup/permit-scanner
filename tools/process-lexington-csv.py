#!/usr/bin/env python3
"""Processa CSV mensais do Lexington MA — extrai permits residenciais qualificados.

Lexington publica relatório mensal CSV via CivicPlus DocumentCenter.
Estrutura validada 03/mai/2026:
  Record #, Permit/License Issued Date, Street No, Street Name, Applicant Name,
  Record Type, Project Cost, Work Description, Occupancy Type

Filtros aplicados:
- Occupancy Type contém "Residential" (skip Commercial / Multi-Family Commercial)
- 7 categorias (kitchen, bath, addition, renovation, new_construction, building_permit, foundation_permit)
- Cutoff 60 dias (Lexington tem delay menor que Reading, mas ainda há gap)

Limitação: CSV não inclui phone/email/owner do applicant. V2 enriquece via login OpenGov.

Saída: app/src/lib/lexington-real.json
"""
import csv
import json
import re
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT_FILES = [
    Path("/tmp/lex-mar2026.xlsx"),  # CSV apesar do extension
    Path("/tmp/lex-apr2026.xlsx"),
]
OUTPUT = ROOT / "app" / "src" / "lib" / "lexington-real.json"


def map_work_type(record_type, description, occupancy):
    """Heurística usando record type + description + occupancy."""
    text = f"{record_type} {description} {occupancy}".lower()

    if any(k in text for k in [
        "new construction", "new home", "new single family",
        "new dwelling", "construct new", "new const", "new house",
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
        "interior renovation", "residential renovation",
        "basement remodel", "build-out", "build out",
        "remodel", "alteration", "alter ", "renovation",
        "rip and reroof", "reroof", "roofing", "roof", "siding",
        "windows", "deck",
    ]):
        return "renovation"

    if any(k in text for k in ["foundation permit", "foundation"]):
        return "foundation_permit"

    if "building" in text and ("residential" in text or "one family" in text):
        return "building_permit"

    return None


def parse_date(v):
    """Converte '2026-03-31 03:24:00 PM' em ISO."""
    if not v:
        return None
    v = str(v).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def process_file(path, cutoff_date):
    if not path.exists():
        print(f"[skip] {path} não existe", file=sys.stderr)
        return []

    out = []
    skipped_old = 0
    skipped_not_relevant = 0
    skipped_commercial = 0
    skipped_no_record = 0

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            record_num = (row.get("Record #") or "").strip()
            if not record_num:
                skipped_no_record += 1
                continue

            # Filtra Residential (skip Commercial / Multi-Family Commercial)
            occupancy = (row.get("Occupancy Type") or "").strip()
            if "residential" not in occupancy.lower():
                skipped_commercial += 1
                continue

            # Data: Permit/License Issued Date
            date_iso = parse_date(row.get("Permit/License Issued Date"))
            if not date_iso or date_iso < cutoff_date:
                skipped_old += 1
                continue

            # Work type
            record_type = (row.get("Record Type") or "").strip()
            description = (row.get("Work Description") or "").strip()
            wt = map_work_type(record_type, description, occupancy)
            if wt is None:
                skipped_not_relevant += 1
                continue

            # Endereço
            st_no = (row.get("Street No") or "").strip()
            st_name = (row.get("Street Name") or "").strip().title()
            address = (f"{st_no} {st_name}".strip()) or "Lexington, MA"

            applicant = (row.get("Applicant Name") or "").strip()

            # Estimated value
            est_value = None
            cost = (row.get("Project Cost") or "").strip()
            if cost:
                try:
                    est_value = float(cost.replace(",", "").replace("$", ""))
                    if est_value <= 0:
                        est_value = None
                except (ValueError, TypeError):
                    pass

            permit = {
                "id": str(uuid.uuid4()),
                "permit_number": record_num,
                "applicant_name": applicant.title() if applicant else None,
                "address": address,
                "city": "Lexington",
                "state": "MA",
                "phone": None,  # Não no CSV — V2 enriquece via OpenGov login
                "email": None,
                "work_type": wt,
                "permit_date": date_iso,
                "application_date": None,  # Não no CSV
                "estimated_value": est_value,
                "status_source": "Permit Issued",  # CSV só lista emitidos
                "source_url": "https://www.lexingtonma.gov/1555/Building-Permit-Activity",
                "description": description if description else None,
                "raw_data": {
                    "source": "lexington-civicplus-csv",
                    "record_type": record_type,
                    "occupancy_type": occupancy,
                    "month_file": path.name,
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            out.append(permit)

    print(f"[{path.name}] {len(out)} qualified | "
          f"skipped: {skipped_old} old, {skipped_not_relevant} not relevant, "
          f"{skipped_commercial} commercial, {skipped_no_record} no_record")
    return out


def main():
    cutoff_dt = (datetime.now(timezone.utc) - timedelta(days=60)).date()
    cutoff_iso = cutoff_dt.isoformat()
    print(f"Cutoff: {cutoff_iso} (últimos 60 dias)\n")

    all_permits = []
    for path in INPUT_FILES:
        all_permits.extend(process_file(path, cutoff_iso))

    seen = set()
    deduped = []
    for p in all_permits:
        if p["permit_number"] not in seen:
            seen.add(p["permit_number"])
            deduped.append(p)

    deduped.sort(key=lambda p: p["permit_date"] or "1900-01-01", reverse=True)

    from collections import Counter
    by_type = Counter(p["work_type"] for p in deduped)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(deduped, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n[ok] {len(deduped)} unique Lexington permits saved to {OUTPUT}")
    print(f"by_work_type: {dict(by_type)}")

    if deduped:
        s = deduped[0]
        print(f"\nSample (most recent):")
        print(f"  {s['permit_number']} - {s['address']}")
        print(f"  Applicant: {s['applicant_name']}")
        print(f"  Type: {s['work_type']}")
        print(f"  Value: ${s['estimated_value']:,.0f}" if s['estimated_value'] else "  Value: —")
        print(f"  Description: {(s['description'] or '')[:120]}")
        total = sum(p['estimated_value'] for p in deduped if p['estimated_value'])
        print(f"\nTotal value: ${total:,.0f}")

if __name__ == "__main__":
    main()
