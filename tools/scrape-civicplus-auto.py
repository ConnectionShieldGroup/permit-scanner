#!/usr/bin/env python3
"""Wrapper automatico pra cidades CivicPlus: Reading, Lexington, Wakefield.

Baixa o(s) arquivo(s) mais recente(s) e dispara o processador específico de cada cidade.

Uso:
    python3 tools/scrape-civicplus-auto.py reading
    python3 tools/scrape-civicplus-auto.py lexington
    python3 tools/scrape-civicplus-auto.py wakefield
    python3 tools/scrape-civicplus-auto.py all
"""
import argparse
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def download(url, dest):
    try:
        data = fetch(url)
        dest.write_bytes(data)
        print(f"  [ok] {dest.name} ({len(data)} bytes)")
        return True
    except urllib.error.HTTPError as e:
        print(f"  [skip] {url}: {e.code}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  [err] {url}: {e}", file=sys.stderr)
        return False


# --------------- READING ---------------
def scrape_reading():
    print("[reading] fetching index page...")
    html = fetch("https://www.readingma.gov/959/Monthly-Building-Permit-Report").decode("utf-8", errors="ignore")
    matches = re.findall(r"DocumentCenter/View/(\d+)/([A-Za-z0-9-]+)", html)
    if not matches:
        print("[reading] no documents found", file=sys.stderr)
        return False

    # 3 mais recentes (página lista em ordem cronológica decrescente)
    for view_id, slug in matches[:3]:
        url = f"https://www.readingma.gov/DocumentCenter/View/{view_id}/{slug}"
        # extract month/year do slug pra nomear o arquivo
        m = re.search(r"([A-Za-z]+)-(\d{4})", slug)
        if not m:
            continue
        month_name, year = m.groups()
        dest = Path(f"/tmp/reading-{view_id}-{month_name}-{year}.xlsx")
        download(url, dest)

    # Dispara processador (que lê todos os arquivos /tmp/reading-*.xlsx)
    print("[reading] running processor...")
    result = subprocess.run(
        ["python3", str(ROOT / "tools" / "process-reading-xlsx.py")],
        capture_output=True, text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
    return result.returncode == 0


# --------------- LEXINGTON ---------------
def scrape_lexington():
    print("[lexington] fetching archive page...")
    html = fetch("https://www.lexingtonma.gov/Archive.aspx?AMID=37").decode("utf-8", errors="ignore")
    # Pega TODOS os ADIDs. Os mais altos sao os mais recentes.
    adids = sorted(set(int(m) for m in re.findall(r'ADID=(\d+)', html)), reverse=True)
    if not adids:
        print("[lexington] no archive items found", file=sys.stderr)
        return False

    for adid in adids[:3]:
        url = f"https://www.lexingtonma.gov/ArchiveCenter/ViewFile/Item/{adid}"
        dest = Path(f"/tmp/lexington-{adid}.csv")
        # Tenta CSV primeiro, depois XLSX
        if not download(url, dest):
            continue

    print("[lexington] running processor...")
    result = subprocess.run(
        ["python3", str(ROOT / "tools" / "process-lexington-csv.py")],
        capture_output=True, text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
    return result.returncode == 0


# --------------- WAKEFIELD ---------------
def scrape_wakefield():
    """Novo padrao 2026: wakefieldma.gov/DocumentCenter (CivicPlus). Scraping da pagina indice."""
    print("[wakefield] fetching index page...")
    html = fetch("https://www.wakefieldma.gov/375/Monthly-Building-Reports").decode("utf-8", errors="ignore")
    matches = re.findall(r"DocumentCenter/View/(\d+)/([A-Za-z0-9-]+)", html)
    if not matches:
        print("[wakefield] no documents found", file=sys.stderr)
        return False

    # Limpa PDFs antigos pra evitar mistura
    for old in Path("/tmp").glob("wakefield-*.pdf"):
        old.unlink()

    for view_id, slug in matches[:3]:
        url = f"https://www.wakefieldma.gov/DocumentCenter/View/{view_id}/{slug}"
        m = re.search(r"([A-Za-z]+)-(\d{4})", slug)
        if not m:
            continue
        month_name, year = m.groups()
        dest = Path(f"/tmp/wakefield-{view_id}-{month_name}-{year}.pdf")
        download(url, dest)

    print("[wakefield] running processor...")
    result = subprocess.run(
        ["python3", str(ROOT / "tools" / "process-wakefield-pdf.py")],
        capture_output=True, text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("city", choices=["reading", "lexington", "wakefield", "all"])
    args = parser.parse_args()

    if args.city == "all":
        for fn in (scrape_reading, scrape_lexington, scrape_wakefield):
            try:
                fn()
            except Exception as e:
                print(f"[err] {fn.__name__}: {e}", file=sys.stderr)
    else:
        fn_map = {
            "reading": scrape_reading,
            "lexington": scrape_lexington,
            "wakefield": scrape_wakefield,
        }
        fn_map[args.city]()


if __name__ == "__main__":
    main()
