# Database backup and migration runbook

**Applies to:** Insight Agent on Windows, SQLite configuration (`data/insight.db`).
**Status:** The backup and migration-copy procedure below was exercised on 2026-10-21. The configured original was not migrated. PostgreSQL behavior remains unverified.

## Tested safety-gate result

The application configuration resolved to `sqlite+aiosqlite:///./data/insight.db` with no `DATABASE_URL` override. The database was at Alembic revision `35fd433a99c2`, size 532,480 bytes, last modified 2026-10-19 06:12:06 UTC. It passed `PRAGMA integrity_check`. The online backup at `%LOCALAPPDATA%\InsightAgent\backups\insight-20261020T190543Z.sqlite3` independently passed integrity and matched the source revision and all table counts (11 tables; 147 total rows, including `alembic_version`). The backup is local and outside the repository; it is not tracked by Git.

A disposable restored copy was upgraded from `35fd433a99c2` to Alembic head `b791c6a48d21`. It passed integrity, retained the essential pre-migration counts (`task_checkpoints` 25, `discoveries` 34, `discovery_sources` 34, `reports` 1, `sources` 4), and contained the lease/digest columns and `research_cancellations` table. The original remains at `35fd433a99c2` and has not been migrated.

The disposable copy was not removed after the test because the cleanup command was rejected. It remains at `%TEMP%\insight-agent-safety-a4afbfcab3974fccb424ae18c9be11d6\migration-copy.sqlite3`; current read-only inspection confirms integrity `ok`, revision `b791c6a48d21`, and 12 tables. Its file owner matches the current Windows user. Whether another process has an open handle has not been verified, so do not delete it until that check is complete. This is an extra copy of the database, not the durable backup.

## Preconditions and stop writers

Before migration or restore, stop the API, scheduler, and every background worker using this database. Confirm they have exited before proceeding. Do not terminate generic Python processes unless you have positively identified them as this application. The SQLite online backup API provides a consistent snapshot while SQLite is active; stopping writers is still required before migration or restore to prevent writes during the maintenance window. Never run Alembic against the configured original until the future authorization described below.

From the repository root, identify the effective database URL without printing its value if it may contain credentials. Current default configuration is read in `backend/app/core/config.py`; `.env` and environment overrides may change it. Do not paste environment dumps into logs or tickets.

## Create a timestamped SQLite backup

The following PowerShell/Python pattern uses SQLite's supported online backup API, refuses to overwrite an existing timestamped file, and writes outside the repository and temporary directories. Set `$source` to the verified configured SQLite file. Do not use a filesystem copy of a live SQLite file.

```powershell
$source = (Resolve-Path 'data\insight.db').Path
$backupDir = Join-Path $env:LOCALAPPDATA 'InsightAgent\backups'
New-Item -ItemType Directory -Force $backupDir | Out-Null
$env:INSIGHT_DB_SOURCE = $source
$env:INSIGHT_BACKUP_DIR = $backupDir
@'
import os, sqlite3
from datetime import datetime, timezone
from pathlib import Path
src_path = Path(os.environ['INSIGHT_DB_SOURCE'])
out_dir = Path(os.environ['INSIGHT_BACKUP_DIR'])
out = out_dir / f"insight-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.sqlite3"
if out.exists(): raise SystemExit(f"Refusing to overwrite {out}")
with sqlite3.connect(f"file:{src_path.as_posix()}?mode=ro", uri=True) as src, sqlite3.connect(out) as dst:
    src.backup(dst)
print(out)
'@ | .\.venv\Scripts\python.exe -
Remove-Item Env:\INSIGHT_DB_SOURCE, Env:\INSIGHT_BACKUP_DIR
```

This API procedure was tested against the configured SQLite database. The shown source path is the repository's current default; if the configured URL points elsewhere, use that actual SQLite file. PostgreSQL needs a database-native backup procedure; do not use this SQLite command for PostgreSQL.

## Verify a backup

Open the backup independently, in read-only mode. Record the integrity result, Alembic revision, table names, and row counts only; do not print table contents or personal data.

```powershell
$env:INSIGHT_CHECK_DB = 'C:\path\to\the\timestamped-backup.sqlite3'
@'
import os, sqlite3
from pathlib import Path
p = Path(os.environ['INSIGHT_CHECK_DB'])
with sqlite3.connect(f"file:{p.as_posix()}?mode=ro", uri=True) as db:
    print('integrity:', db.execute('PRAGMA integrity_check').fetchone()[0])
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    print('revision:', db.execute('SELECT version_num FROM alembic_version').fetchone()[0])
    for table in tables:
        safe = table.replace('"', '""')
        print(table, db.execute(f'SELECT COUNT(*) FROM "{safe}"').fetchone()[0])
'@ | .\.venv\Scripts\python.exe -
Remove-Item Env:\INSIGHT_CHECK_DB
```

Compare the counts and revision with a read-only snapshot of the source. Do not proceed if the backup cannot be opened, integrity is not `ok`, or the metadata differs. Retain the backup until an independently verified replacement backup exists and the owner approves disposal.

## Test migrations on a separate copy (tested workflow)

Restore the verified backup into a uniquely named disposable directory under `$env:TEMP` using `sqlite3.Connection.backup()` as above (source = verified backup; destination = new copy). Never select `data\insight.db` as the destination. Then point Alembic only at the copy. Windows paths must use forward slashes in the URL.

```powershell
$env:INSIGHT_VERIFIED_BACKUP = 'C:\path\to\verified-backup.sqlite3'
$copy = Join-Path $env:TEMP ('insight-agent-migration-copy-' + [guid]::NewGuid().ToString('N') + '.sqlite3')
$env:INSIGHT_MIGRATION_COPY = $copy
@'
import os, sqlite3
from pathlib import Path
src = Path(os.environ['INSIGHT_VERIFIED_BACKUP'])
dst = Path(os.environ['INSIGHT_MIGRATION_COPY'])
if dst.exists(): raise SystemExit(f"Refusing to overwrite {dst}")
with sqlite3.connect(f"file:{src.as_posix()}?mode=ro", uri=True) as source, sqlite3.connect(dst) as target:
    source.backup(target)
'@ | .\.venv\Scripts\python.exe -
$env:DATABASE_URL = 'sqlite:///' + $copy.Replace('\','/')
$env:PYTHONPATH = (Join-Path (Get-Location) 'backend')
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
```

The procedure was tested using a unique temporary directory and an online backup restore. Migration output reached `b791c6a48d21` from `35fd433a99c2`. Before migration, record counts; afterward confirm counts of existing records are unchanged and verify schema/integrity:

```powershell
@'
import os, sqlite3
from pathlib import Path
p = Path(os.environ['DATABASE_URL'].removeprefix('sqlite:///'))
with sqlite3.connect(f"file:{p.as_posix()}?mode=ro", uri=True) as db:
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert db.execute('SELECT version_num FROM alembic_version').fetchone()[0] == 'b791c6a48d21'
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert 'research_cancellations' in tables
    columns = {r[1] for r in db.execute('PRAGMA table_info(scheduled_runs)')}
    assert {'lease_owner', 'lease_expires_at', 'digest_md', 'coverage_json'} <= columns
    print('integrity, revision, required tables and columns verified')
'@ | .\.venv\Scripts\python.exe -
Remove-Item Env:\DATABASE_URL, Env:\PYTHONPATH
```

The schema assertions above were exercised against the disposable migration copy; the generic backup path and post-migration assertion snippet are operational examples. Compare pre/post record counts for each migration test. Keep the copy until checks/tests finish, then delete only that disposable file after verifying its full path and name. Never delete the durable backup as cleanup.

## Restore procedure

**Not executed against the configured database.** Restore is a recovery operation and requires an approved maintenance window. Stop all writers. First make and verify a separate backup of the current database. Restore the chosen verified backup into a new sibling file with the same Python `sqlite3.Connection.backup()` procedure (source = verified backup; destination = new sibling); run `PRAGMA integrity_check`, check Alembic revision, and compare table counts. Keep the original file untouched. Only after those checks and explicit authorization should an operator arrange a reversible file swap: preserve the current original under a new timestamped name, place the verified restored file at the configured path, then open it read-only and recheck revision, schema, counts, and integrity before restarting the application. If any validation fails, stop and retain all files; do not overwrite the original or attempt a second restore in place.

## If any step fails

Stop at the failing step. Preserve the original, durable backup, and disposable copy for diagnosis. Do not run migrations against the original as a workaround. Record only paths, command exit status, Alembic revision, table counts, and integrity result; redact URLs and credentials. Resolve the cause on a fresh disposable copy and repeat backup verification before any future production operation.

## Future migration of the configured database

These are **not authorized or executed** by this runbook. Only after explicit owner authorization: (1) confirm the configured URL/path and stop all writers; (2) create and independently verify a new timestamped backup; (3) record current `alembic current` and source counts; (4) set `DATABASE_URL` only to the confirmed configured SQLite URL, run `.\.venv\Scripts\python.exe -m alembic upgrade head`, then unset the override; (5) verify Alembic head, `PRAGMA integrity_check`, required columns/tables, preserved records, and relevant application tests; (6) restart the application and check readiness/logs; (7) retain the backup until the owner confirms recovery is no longer needed. If any check fails, stop writers and use the verified restore procedure only with authorization. PostgreSQL migration remains separately unverified and requires a PostgreSQL test service before production use.
