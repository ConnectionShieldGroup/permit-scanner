---
description: Roda scrape em todas as cidades ativas e atualiza o banco Supabase com permits novos
allowed-tools: Bash, Read, Edit
---

# Atualizar permits

Reginaldo pediu pra atualizar o banco com permits novos das cidades cobertas.

## Passo 1: avisar que vai demorar

Diga: "Vou rodar o scrape das 9 cidades. Demora 5-10 minutos. Aguarde."

## Passo 2: rodar scripts de scrape

Pra cada cidade ativa, executar o tool correspondente:

```bash
cd "$(git rev-parse --show-toplevel)"

# Hingham (PermitEyes AJAX direto)
python3 tools/scrape-hingham-local.py --days 15

# Reading (CivicPlus XLSX) — manual, baixa último mês disponível
# (Reading publica com delay 2-3 meses, então só atualiza periodicamente)

# Lexington (CivicPlus CSV) — idem Reading

# Wakefield (CivicPlus PDF) — idem Reading

# Somerville (Socrata Open Data — sempre atualizado)
python3 tools/process-somerville-socrata.py

# Braintree, North Reading, Randolph, Hanson (PermitEyes via Browserless)
# Requer BROWSERLESS_TOKEN (pedir pra Fábio se não tiver)
```

## Passo 3: importar pro Supabase

```bash
python3 tools/import-permits-to-supabase.py
```

## Passo 4: relatar resultado

Conta quantos permits NOVOS entraram (comparar antes/depois) e quantos foram atualizados.

Exemplo de relatório:
```
✅ Atualização concluída!
- 47 permits novos adicionados
- 12 permits existentes atualizados (mudança de status)
- Total no banco: 1.312 permits
- Por cidade: Hingham +12, Somerville +28, Randolph +4, ...

Veja no app: https://permit-scanner.vercel.app
```

## Em caso de erro

Se algum scraper falhar (cidade fora do ar, mudança de site, etc):
1. Reportar qual cidade falhou
2. Continuar com as outras (não parar tudo)
3. Sugerir Reginaldo pedir ajuda do Fábio se for crítico
