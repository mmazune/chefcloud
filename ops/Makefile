# E22.E Index Deployment — Makefile Helpers
#
# Usage:
#   make apply-indexes DB="postgresql://user:pass@host:5432/dbname"
#   make explain-overview DB="postgresql://user:pass@host:5432/dbname"
#   make explain-rankings DB="postgresql://user:pass@host:5432/dbname"
#   make explain-budgets DB="postgresql://user:pass@host:5432/dbname"

# Default database URL (can be overridden with DB= argument)
DB ?= $(DATABASE_URL)

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

.PHONY: help apply-indexes explain-overview explain-rankings explain-budgets verify-indexes

help:
@echo "$(GREEN)E22.E Index Deployment — Available Commands$(NC)"
@echo ""
@echo "$(YELLOW)Deployment:$(NC)"
@echo "  make apply-indexes DB=<url>    Apply indexes to target database (safe, idempotent)"
@echo ""
@echo "$(YELLOW)Verification:$(NC)"
@echo "  make verify-indexes DB=<url>   Check if indexes exist"
@echo "  make explain-overview DB=<url> Show query plan for franchise overview"
@echo "  make explain-rankings DB=<url> Show query plan for franchise rankings"
@echo "  make explain-budgets DB=<url>  Show query plan for franchise budgets"
@echo ""
@echo "$(YELLOW)Example:$(NC)"
@echo "  export DATABASE_URL='postgresql://user:pass@localhost:5432/chefcloud'"
@echo "  make apply-indexes"
@echo "  make verify-indexes"
@echo ""

apply-indexes:
@[ -n "$(DB)" ] || (echo "$(RED)ERROR: DATABASE_URL not set. Use: make apply-indexes DB=<url>$(NC)" && exit 1)
@echo "$(YELLOW)Applying indexes to database...$(NC)"
@psql "$(DB)" -v ON_ERROR_STOP=1 -f sql/indexes/001_franchise_indexes.sql
@echo "$(GREEN)✓ Indexes applied successfully$(NC)"

verify-indexes:
@[ -n "$(DB)" ] || (echo "$(RED)ERROR: DATABASE_URL not set. Use: make verify-indexes DB=<url>$(NC)" && exit 1)
@echo "$(YELLOW)Checking for E22.E indexes...$(NC)"
@psql "$(DB)" -c "\
ame, \
ame, \
dexname, \
_size(indexrelid)) as index_size \
dexes \
dexrelname IN ( \
kings_org_metric_period', \
v_batches_org_sku', \
ments_org_status_created' \
BY tablename, indexrelname;"

explain-overview:
@[ -n "$(DB)" ] || (echo "$(RED)ERROR: DATABASE_URL not set. Use: make explain-overview DB=<url>$(NC)" && exit 1)
@echo "$(YELLOW)Query plan for franchise_overview...$(NC)"
@psql "$(DB)" -c "\
 (ANALYZE, BUFFERS) \
FROM franchise_overview \
AND period='2025-11' \
|| echo "$(RED)Table may not exist in this database$(NC)"

explain-rankings:
@[ -n "$(DB)" ] || (echo "$(RED)ERROR: DATABASE_URL not set. Use: make explain-rankings DB=<url>$(NC)" && exit 1)
@echo "$(YELLOW)Query plan for franchise_rankings...$(NC)"
@psql "$(DB)" -c "\
 (ANALYZE, BUFFERS) \
FROM franchise_rankings \
AND metric='sales' AND period='2025-11' \
 value DESC \
|| echo "$(RED)Table may not exist in this database$(NC)"

explain-budgets:
@[ -n "$(DB)" ] || (echo "$(RED)ERROR: DATABASE_URL not set. Use: make explain-budgets DB=<url>$(NC)" && exit 1)
@echo "$(YELLOW)Query plan for franchise_budgets...$(NC)"
@psql "$(DB)" -c "\
 (ANALYZE, BUFFERS) \
FROM franchise_budgets \
AND cost_center='ops' AND period='2025-11';" \
"$(RED)Table may not exist in this database$(NC)"
