#!/usr/bin/env python3
"""Processa PDFs mensais do Wakefield MA — extrai permits residenciais qualificados.

Wakefield publica relatório PDF mensal via CivicPlus DocumentCenter.
Estrutura validada 03/mai/2026 (March 2026):
  Page 1: estatísticas agregadas (skip)
  Pages 2+: tabela com 9 colunas:
    Record # | Record Type | Amount Paid | Date Paid | Owner Name |
    Full Address | Estimated Cost | Description of Proposed Work | Contractor Name

Não tem phone/email. V2 enriquece se acessar PermitEyes/portal com login.

Saída: app/src/lib/wakefield-real.json
"""
import json
import re
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("Install pdfplumber: pip3 install pdfplumber", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
# Aceita arquivos com nome wakefield-* (novo padrao do scrape-civicplus-auto.py)
# OU wak-*-Month-YYYY.pdf (legado). Glob deduplica e processa todos.
INPUT_FILES = sorted(set(
    list(Path("/tmp").glob("wakefield-*.pdf")) +
    list(Path("/tmp").glob("wak-*.pdf"))
))
OUTPUT = ROOT / "app" / "src" / "lib" / "wakefield-real.json"


def map_work_type(record_type, description):
    text = f"{record_type} {description}".lower()

    if any(k in text for k in [
        "new construction", "new home", "new single family",
        "new dwelling", "construct new", "new const", "new house",
        "two family dwelling", "single family dwelling",
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
        "room addition", "garage addition", "second story addition", "addition",
        "accessory dwelling unit", "adu", "expand attic", "dormer",
    ]):
        return "addition"

    if any(k in text for k in [
        "interior renovation", "residential renovation", "basement renovation",
        "basement remodel", "remodel", "alteration", "renovation",
        "rip and reroof", "rip & reroof", "reroof", "re-roof", "roofing", "roof",
        "siding", "windows", "deck", "front porch",
        "doors, insulation, roofing, siding and windows",
    ]):
        return "renovation"

    if any(k in text for k in ["foundation permit", "foundation"]):
        return "foundation_permit"

    if "building permit" in text:
        return "building_permit"

    return None


def parse_date_mm_dd_yyyy(s):
    """Converte '3/24/2026' em ISO."""
    if not s:
        return None
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s.strip())
    if not m:
        return None
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"


def clean_str(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def extract_pdf(path):
    """Extrai todas as linhas de tabela do PDF (skip page 1 = estatísticas)."""
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages[1:]:  # skip page 1
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or not row[0]:
                        continue
                    # Heurística: row válida tem 9 colunas e Record # começa com BP-
                    if len(row) >= 9 and row[0] and re.match(r"^BP-\d", str(row[0])):
                        rows.append(row)
    return rows


def process_file(path, cutoff_date):
    if not path.exists():
        print(f"[skip] {path} não existe", file=sys.stderr)
        return []

    rows = extract_pdf(path)
    out = []
    skipped_old = 0
    skipped_not_relevant = 0
    skipped_no_address = 0

    for row in rows:
        record_num = clean_str(row[0])
        record_type = clean_str(row[1])
        amount_paid = clean_str(row[2])
        date_paid = clean_str(row[3])
        owner = clean_str(row[4])
        address = clean_str(row[5])
        cost = clean_str(row[6])
        description = clean_str(row[7])
        contractor = clean_str(row[8]) if len(row) > 8 else ""

        if not address:
            skipped_no_address += 1
            continue

        # Date filter
        date_iso = parse_date_mm_dd_yyyy(date_paid)
        if not date_iso or date_iso < cutoff_date:
            skipped_old += 1
            continue

        # Work type filter
        wt = map_work_type(record_type, description)
        if wt is None:
            skipped_not_relevant += 1
            continue

        # Cost
        est_value = None
        if cost:
            try:
                est_value = float(cost.replace("$", "").replace(",", ""))
                if est_value <= 0:
                    est_value = None
            except (ValueError, TypeError):
                pass

        # Applicant: contractor é mais útil pra prospect (já tá tocando obra), owner como fallback
        applicant = contractor or owner

        permit = {
            "id": str(uuid.uuid4()),
            "permit_number": record_num,
            "applicant_name": applicant.title() if applicant else None,
            "address": address.title(),
            "city": "Wakefield",
            "state": "MA",
            "phone": None,
            "email": None,
            "work_type": wt,
            "permit_date": date_iso,
            "application_date": None,
            "estimated_value": est_value,
            "status_source": "Permit Issued",
            "source_url": "https://www.wakefieldma.gov/375/Monthly-Building-Reports",
            "description": description if description else None,
            "raw_data": {
                "source": "wakefield-civicplus-pdf",
                "record_type": record_type,
                "owner_name": owner.title() if owner else None,
                "contractor_name": contractor.title() if contractor else None,
                "amount_paid": amount_paid,
                "month_file": path.name,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        out.append(permit)

    print(f"[{path.name}] {len(out)} qualified | "
          f"skipped: {skipped_old} old, {skipped_not_relevant} not relevant, "
          f"{skipped_no_address} no_address | extracted: {len(rows)}")
    return out


def main():
    cutoff_dt = (datetime.now(timezone.utc) - timedelta(days=90)).date()
    cutoff_iso = cutoff_dt.isoformat()
    print(f"Cutoff: {cutoff_iso} (últimos 90 dias)\n")

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

    print(f"\n[ok] {len(deduped)} unique Wakefield permits saved to {OUTPUT}")
    print(f"by_work_type: {dict(by_type)}")

    if deduped:
        s = deduped[0]
        print(f"\nSample (most recent):")
        print(f"  {s['permit_number']} - {s['address']}")
        print(f"  Contractor: {s['applicant_name']}")
        print(f"  Owner: {s['raw_data'].get('owner_name')}")
        print(f"  Type: {s['work_type']}")
        print(f"  Value: ${s['estimated_value']:,.0f}" if s['estimated_value'] else "  Value: —")
        print(f"  Description: {s['description']}")
        total = sum(p['estimated_value'] for p in deduped if p['estimated_value'])
        print(f"\nTotal value: ${total:,.0f}")

if __name__ == "__main__":
    main()
