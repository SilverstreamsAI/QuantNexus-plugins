# Database Path Configuration

## Overview

The backtest engine uses the Desktop framework's shared SQLite database (`quantnexus.db`) to store:
- Strategies (`nona_algorithms` table)
- Backtest tasks (`backtest_tasks` table)
- Strategy results (`strategy_runs` table)
- Trade records (`trade_records` table)

**Critical**: All components (Phase 2-3) must use the same database file as the Desktop framework.

---

## Database Architecture

### Framework Database (quantnexus.db)

**Location:**
```
Development:    /data/ws/QuantNexus/apps/desktop/data/quantnexus.db
Production:     <userData>/data/quantnexus.db
```

**Managed by:** `apps/desktop/src/main/database/db-manager.ts`

**Tables:**
- `nona_algorithms` - Strategy definitions (managed by Framework)
- `nona_backtest_results` - Legacy backtest results (managed by Framework)
- `nona_factors` - Factor definitions
- `hub_files` - Hub file registry
- `plugin_registry` - Plugin metadata
- `schema_version` - Database schema version

**Plugin Tables (added by backtest engine):**
- `backtest_tasks` - Task lifecycle tracking
- `strategy_runs` - Strategy execution results
- `trade_records` - Individual trade details

---

## Configuration Methods

### Method 1: Environment Variable (Recommended)

**Host sets environment variable before starting plugin:**

```typescript
// In Electron main process (TypeScript)
import { getDatabaseManager } from './database/db-manager';

// Get framework database path
const db = getDatabaseManager();
const dbPath = db.getPath();

// Set environment variable for plugin
process.env.QUANTNEXUS_DB_PATH = dbPath;

// Start gRPC service (plugin will read environment variable)
await startBacktestService();
```

**Plugin reads environment variable:**

```python
# Python plugin code (automatic)
import os

db_path = os.environ.get('QUANTNEXUS_DB_PATH')
# Returns: /data/ws/QuantNexus/apps/desktop/data/quantnexus.db
```

**Advantages:**
- ✅ No code changes needed in plugin
- ✅ Automatic propagation to all modules
- ✅ Host controls database location

---

### Method 2: gRPC Parameter Passing

**Update proto definition:**

```protobuf
// proto/backtest.proto
message BacktestRequest {
  string config_json = 1;
  string db_path = 2;  // Add database path field
}
```

**Host passes database path:**

```typescript
// In Electron main process
const db = getDatabaseManager();
const dbPath = db.getPath();

// gRPC call
const response = await backtestClient.RunBacktest({
  config_json: JSON.stringify(config),
  db_path: dbPath  // Pass database path
});
```

**Plugin receives database path:**

```python
# In service.pyx
def RunBacktest(self, request, context):
    json_data = json.loads(request.config_json)
    db_path = request.db_path  # Get database path from request

    # Pass to loader
    loader = StrategyDatabaseLoader(db_path=db_path)
    task_store = TaskStore(db_path=db_path)
    result_store = ResultStore(db_path=db_path)
```

**Advantages:**
- ✅ Explicit control per request
- ✅ Works with multiple databases
- ✅ Easy to test with different paths

**Disadvantages:**
- ⚠️ Requires proto update
- ⚠️ Need to pass path to all components

---

### Method 3: Fallback (Development Only)

If neither Method 1 nor 2 is configured, plugin falls back to:

```python
# Relative path calculation
db_path = Path(__file__).parent.parent.parent.parent.parent.parent / "data" / "quantnexus.db"
```

**⚠️ Warning:** This only works in development with specific directory structure. Not reliable in production.

---

## Implementation Status

### Fixed Files (✅ Support all 3 methods)

1. **strategy/database_loader.py**
   ```python
   def _get_default_db_path(self) -> str:
       # Priority: ENV > Relative path
       db_path = os.environ.get('QUANTNEXUS_DB_PATH')
       if db_path:
           return db_path
       return str(Path(...) / "data" / "quantnexus.db")
   ```

2. **storage/task_store.py**
   ```python
   def _get_default_db_path(self) -> str:
       # Same logic as database_loader.py
       db_path = os.environ.get('QUANTNEXUS_DB_PATH')
       if db_path:
           return db_path
       return str(Path(...) / "data" / "quantnexus.db")
   ```

3. **storage/result_store.py**
   ```python
   def _get_default_db_path(self) -> str:
       # Same logic as database_loader.py
       db_path = os.environ.get('QUANTNEXUS_DB_PATH')
       if db_path:
           return db_path
       return str(Path(...) / "data" / "quantnexus.db")
   ```

---

## Usage Examples

### Example 1: Using Environment Variable

```bash
# Set environment variable
export QUANTNEXUS_DB_PATH=/path/to/quantnexus.db

# Run plugin (automatically uses environment variable)
python service.py
```

```python
# Plugin code (no changes needed)
loader = StrategyDatabaseLoader()  # Automatically uses QUANTNEXUS_DB_PATH
task_store = TaskStore()           # Automatically uses QUANTNEXUS_DB_PATH
result_store = ResultStore()       # Automatically uses QUANTNEXUS_DB_PATH
```

---

### Example 2: Explicit Path Passing

```python
# Host determines path
from pathlib import Path
db_path = Path.home() / ".config" / "quantnexus" / "data" / "quantnexus.db"

# Pass to plugin components
loader = StrategyDatabaseLoader(db_path=str(db_path))
task_store = TaskStore(db_path=str(db_path))
result_store = ResultStore(db_path=str(db_path))
```

---

### Example 3: Testing with In-Memory Database

```python
# Use SQLite in-memory database for testing
loader = StrategyDatabaseLoader(db_path=":memory:")
task_store = TaskStore(db_path=":memory:")
result_store = ResultStore(db_path=":memory:")

# Each component gets independent in-memory database
# Useful for unit testing
```

---

## Verification

### Check Current Database Path

```python
from strategy.database_loader import StrategyDatabaseLoader

loader = StrategyDatabaseLoader()
print(f"Using database: {loader.db_path}")
# Should output: /data/ws/QuantNexus/apps/desktop/data/quantnexus.db
```

### Verify Database Contents

```bash
# Check if using correct database
sqlite3 /data/ws/QuantNexus/apps/desktop/data/quantnexus.db ".tables"

# Expected output:
# backtest_tasks         nona_algorithms        plugin_registry
# nona_backtest_results  nona_factors           schema_version
# strategy_runs          trade_records
```

### Test Database Access

```python
from strategy.database_loader import StrategyDatabaseLoader

loader = StrategyDatabaseLoader()

# Should see existing strategies from framework
strategies = loader.get_all_strategies()
print(f"Found {len(strategies)} strategies in database")
```

---

## Troubleshooting

### Problem: "No such table: nona_algorithms"

**Cause:** Using wrong database file (e.g., `nexus.db` instead of `quantnexus.db`)

**Solution:**
```bash
# Check which database is being used
python -c "from strategy.database_loader import StrategyDatabaseLoader; print(StrategyDatabaseLoader().db_path)"

# Set correct path
export QUANTNEXUS_DB_PATH=/data/ws/QuantNexus/apps/desktop/data/quantnexus.db
```

---

### Problem: "Database is locked"

**Cause:** Multiple processes accessing same database without WAL mode

**Solution:**
```python
# Ensure WAL mode is enabled (framework handles this)
# Check current mode:
import sqlite3
conn = sqlite3.connect(db_path)
print(conn.execute("PRAGMA journal_mode").fetchone())
# Should output: ('wal',)
```

---

### Problem: "Tables not found"

**Cause:** Database not initialized with plugin tables

**Solution:**
```python
# Tables are auto-created on first access
from storage.task_store import TaskStore
from storage.result_store import ResultStore

# This creates tables if they don't exist
task_store = TaskStore()
result_store = ResultStore()
```

---

## Migration Notes

### From Old Code (nexus.db) to New Code (quantnexus.db)

**Old hardcoded path:**
```python
# ❌ Wrong
db_path = Path(...) / "data" / "nexus.db"
```

**New flexible path:**
```python
# ✅ Correct
db_path = os.environ.get('QUANTNEXUS_DB_PATH') or Path(...) / "data" / "quantnexus.db"
```

**Migration checklist:**
- [x] Update `strategy/database_loader.py`
- [x] Update `storage/task_store.py`
- [x] Update `storage/result_store.py`
- [ ] Update gRPC service to set environment variable (TODO)
- [ ] Update proto definition to support db_path parameter (TODO)

---

## Best Practices

1. **Always use environment variable in production**
   - Let Host control database location
   - Avoid hardcoded paths

2. **Pass db_path explicitly in tests**
   - Use `:memory:` for unit tests
   - Use temp files for integration tests

3. **Check database path on startup**
   - Log the actual path being used
   - Verify it matches expected location

4. **Use single database for all components**
   - Don't create multiple database connections
   - Reuse TaskStore/ResultStore instances

5. **Enable WAL mode for concurrency**
   - Framework handles this automatically
   - Allows reader-writer concurrency

---

## References

- **Framework Database Manager:** `apps/desktop/src/main/database/db-manager.ts`
- **Database Service:** `apps/desktop/src/main/services/database-service.ts`
- **Schema Migrations:** `apps/desktop/src/main/database/migrations/`
- **Database Schema Doc:** `docs/design/TICKET_110_DESKTOP_DATABASE_SCHEMA.md`
