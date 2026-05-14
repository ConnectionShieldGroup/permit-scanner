#!/usr/bin/env python3
"""
Importa todos os 1.277 permits locais (8 cidades) pro Supabase do Reginaldo.

Usa REST API do Supabase com service_role key.
Idempotente: faz upsert por permit_number.

Uso: python3 tools/import-permits-to-supabase.py
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

# Carrega creds
CREDS_FILE = Path(__file__).resolve().parent.parent / ".creds" / "supabase.env"
creds = {}
for line in CREDS_FILE.read_text().splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        creds[k.strip()] = v.strip()

URL = creds["SUPABASE_URL"]
KEY = creds["SUPABASE_SERVICE_ROLE_KEY"]

ROOT = Path(__file__).resolve().parent.parent

CITY_FILES = [
    "hingham-real.json",
    "reading-real.json",
    "lexington-real.json",
    "wakefield-real.json",
    "braintree-real.json",
    "northreading-real.json",
    "randolph-real.json",
    "hanson-real.json",
    "somerville-real.json",
    "cohasset-real.json",
]


def upsert_batch(records):
    """Upsert em lote via REST API com prefer: resolution=merge-duplicates."""
    body = json.dumps(records).encode()
    req = urllib.request.Request(
        f"{URL}/rest/v1/permits?on_conflict=permit_number",
        data=body,
        method="POST",
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    all_permits = []
    for fname in CITY_FILES:
        path = ROOT / "app" / "src" / "lib" / fname
        if not path.exists():
            print(f"[skip] {fname} não encontrado")
            continue
        permits = json.loads(path.read_text())
        # Adapta schema pra match com tabela
        for p in permits:
            # Remove campos que não existem na tabela
            db_record = {
                "permit_number": p["permit_number"],
                "applicant_name": p.get("applicant_name"),
                "address": p["address"],
                "city": p["city"],
                "state": p.get("state", "MA"),
                "phone": p.get("phone"),
                "email": p.get("email"),
                "work_type": p.get("work_type", "building_permit"),
                "permit_date": p.get("permit_date"),
                "application_date": p.get("application_date"),
                "estimated_value": p.get("estimated_value"),
                "status_source": p.get("status_source"),
                "source_url": p.get("source_url"),
                "description": p.get("description"),
                "raw_data": p.get("raw_data", {}),
            }
            all_permits.append(db_record)
        print(f"[load] {fname}: {len(permits)} permits")

    # Dedupe por permit_number (alguns Permitnumbers se repetem entre cidades,
    # quebrando o ON CONFLICT batch — fica último vence)
    seen = {}
    for p in all_permits:
        seen[p["permit_number"]] = p
    all_permits = list(seen.values())

    print(f"\n[i] Total deduped: {len(all_permits)} permits to upsert")
    print(f"[i] Target: {URL}")

    # Batch de 100 por request (Supabase aceita até 1000 mas 100 é seguro)
    BATCH = 100
    total_ok = 0
    total_err = 0
    for i in range(0, len(all_permits), BATCH):
        batch = all_permits[i : i + BATCH]
        status, err = upsert_batch(batch)
        if status in (200, 201):
            total_ok += len(batch)
            print(f"  [{i+len(batch)}/{len(all_permits)}] OK")
        else:
            total_err += len(batch)
            print(f"  [{i+len(batch)}/{len(all_permits)}] ERR {status}: {err[:200] if err else ''}")
            if total_err > 200:
                print("[!] Too many errors, aborting")
                sys.exit(1)

    print(f"\n[ok] Imported {total_ok}/{len(all_permits)} permits")
    print(f"[i] Erros: {total_err}")


if __name__ == "__main__":
    main()
