import os
import subprocess
import sys

from sqlalchemy import inspect, text

import main  # noqa: F401  (loads every model, like the running app)
from Models.database import Base, engine


def main_test():
    url = os.getenv("DATABASE_URL") or ""
    if "modtest" not in url:
        print("Refusing to run: DATABASE_URL must point at a database whose name "
              "contains 'modtest'. This script deletes every table.")
        sys.exit(2)

    # EMPTIES the whole database in DATABASE_URL. Never run this against the real database.
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    engine.dispose()

    result = subprocess.run([sys.executable, "-m", "Models.create_tables"], capture_output=True, text=True)
    print(result.stdout.strip() or result.stderr.strip()[-500:])

    expected = set(Base.metadata.tables)
    found = set(inspect(engine).get_table_names())
    missing = sorted(expected - found)

    passed = result.returncode == 0 and not missing
    print(f"  {'PASS' if result.returncode == 0 else 'FAIL'}  python -m Models.create_tables runs")
    print(f"  {'PASS' if not missing else 'FAIL'}  every model's table exists ({len(expected)} tables)"
          + (f" -> missing: {', '.join(missing)}" if missing else ""))
    print(f"  {'PASS' if 'audit_logs' in found else 'FAIL'}  audit_logs exists")
    sys.exit(0 if passed and "audit_logs" in found else 1)


if __name__ == "__main__":
    main_test()
