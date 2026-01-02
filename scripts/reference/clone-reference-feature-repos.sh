#!/bin/bash
# Clone/Update Feature-Level Reference Repositories
# Usage: ./scripts/reference/clone-reference-feature-repos.sh
#
# This script:
# 1. Clones missing repos (shallow, depth=1)
# 2. Pulls updates for existing repos (fast-forward only)
# 3. Regenerates MANIFEST.json with current commit info

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REF_DIR="$REPO_ROOT/reference-feature-repos"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Repo definitions: domain|name|url
REPOS=(
    "accounting|bigcapital|https://github.com/bigcapitalhq/bigcapital.git"
    "accounting|hledger|https://github.com/simonmichael/hledger.git"
    "accounting|beancount|https://github.com/beancount/beancount.git"
    "inventory-procurement|InvenTree|https://github.com/inventree/InvenTree.git"
    "inventory-procurement|medusa|https://github.com/medusajs/medusa.git"
    "reservations|TastyIgniter|https://github.com/tastyigniter/TastyIgniter.git"
    "reservations|easyappointments|https://github.com/alextselegidis/easyappointments.git"
    "reservations|cal.com|https://github.com/calcom/cal.com.git"
    "workforce|kimai|https://github.com/kimai/kimai.git"
    "billing-subscriptions|killbill|https://github.com/killbill/killbill.git"
    "billing-subscriptions|lago|https://github.com/getlago/lago.git"
    "ui-systems|appsmith|https://github.com/appsmithorg/appsmith.git"
    "ui-systems|tremor|https://github.com/tremorlabs/tremor.git"
    "qa-testing|playwright|https://github.com/microsoft/playwright.git"
    "qa-testing|cypress|https://github.com/cypress-io/cypress.git"
    "security|CheatSheetSeries|https://github.com/OWASP/CheatSheetSeries.git"
    "security|ASVS|https://github.com/OWASP/ASVS.git"
    "security|juice-shop|https://github.com/juice-shop/juice-shop.git"
)

# Create directories
create_directories() {
    log_info "Creating directory structure..."
    mkdir -p "$REF_DIR"/{accounting,inventory-procurement,reservations,workforce,billing-subscriptions,ui-systems,qa-testing,security}
}

# Clone or update a single repo
process_repo() {
    local domain=$1
    local name=$2
    local url=$3
    local target_dir="$REF_DIR/$domain/$name"
    
    if [ -d "$target_dir/.git" ]; then
        log_info "Updating $domain/$name..."
        cd "$target_dir"
        timeout 5m git fetch origin --depth=1 2>&1 || { log_warn "Fetch failed for $name"; return 1; }
        timeout 2m git reset --hard origin/$(git rev-parse --abbrev-ref HEAD) 2>&1 || { log_warn "Reset failed for $name"; return 1; }
        cd "$REPO_ROOT"
    else
        log_info "Cloning $domain/$name..."
        rm -rf "$target_dir" 2>/dev/null || true
        timeout 10m git clone --depth 1 "$url" "$target_dir" 2>&1 || { log_error "Clone failed for $name"; return 1; }
    fi
}

# Detect license type from file content
detect_license() {
    local license_file=$1
    if [ -z "$license_file" ] || [ ! -f "$license_file" ]; then
        echo "UNKNOWN"
        return
    fi
    
    if grep -q -i "apache\s*license" "$license_file" 2>/dev/null; then
        echo "Apache-2.0"
    elif grep -q -i "MIT License" "$license_file" 2>/dev/null; then
        echo "MIT"
    elif grep -q -i "Permission is hereby granted, free of charge" "$license_file" 2>/dev/null; then
        echo "MIT"
    elif grep -q -i "GNU AFFERO GENERAL PUBLIC LICENSE" "$license_file" 2>/dev/null; then
        echo "AGPL-3.0"
    elif grep -q -i "GNU GENERAL PUBLIC LICENSE" "$license_file" 2>/dev/null; then
        if grep -q "Version 3" "$license_file" 2>/dev/null; then
            echo "GPL-3.0"
        else
            echo "GPL-2.0"
        fi
    elif grep -q -i "BSD" "$license_file" 2>/dev/null; then
        echo "BSD"
    elif grep -q -i "Creative Commons" "$license_file" 2>/dev/null; then
        echo "CC-BY-4.0"
    else
        echo "UNKNOWN"
    fi
}

# Generate MANIFEST.json
generate_manifest() {
    log_info "Generating MANIFEST.json..."
    
    local manifest_file="$REF_DIR/MANIFEST.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local permissive_count=0
    local copyleft_count=0
    local unknown_count=0
    
    # Build JSON
    cat > "$manifest_file" << 'HEADER'
{
  "generatedAt": "TIMESTAMP_PLACEHOLDER",
  "description": "Feature-level reference repositories for architecture study and clean-room pattern extraction",
  "licensePolicy": {
    "permissive": "MIT, Apache-2.0, BSD, CC-BY - Pattern adaptation allowed with attribution",
    "copyleft": "GPL-*, AGPL-* - Architecture study only, no code copying",
    "unknown": "View-only, no adaptation"
  },
  "repos": [
HEADER

    sed -i "s/TIMESTAMP_PLACEHOLDER/$timestamp/" "$manifest_file"
    
    local first=true
    for repo_entry in "${REPOS[@]}"; do
        IFS='|' read -r domain name url <<< "$repo_entry"
        local target_dir="$REF_DIR/$domain/$name"
        
        if [ -d "$target_dir/.git" ]; then
            cd "$target_dir"
            local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
            local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
            local license_file=$(ls LICENSE* COPYING* license* copying* 2>/dev/null | head -1)
            local license_type=$(detect_license "$license_file")
            
            # Count by license type
            case "$license_type" in
                MIT|Apache-2.0|BSD|CC-BY-4.0) ((permissive_count++)) ;;
                GPL*|AGPL*) ((copyleft_count++)) ;;
                *) ((unknown_count++)) ;;
            esac
            
            if [ "$first" = true ]; then
                first=false
            else
                echo "," >> "$manifest_file"
            fi
            
            cat >> "$manifest_file" << ENTRY
    {
      "name": "$name",
      "url": "$url",
      "domain": "$domain",
      "licenseDetected": "$license_type",
      "licenseFilePath": "$license_file",
      "headCommit": "$commit",
      "defaultBranch": "$branch",
      "notes": ""
    }
ENTRY
            cd "$REPO_ROOT"
        fi
    done
    
    local total=$((permissive_count + copyleft_count + unknown_count))
    
    cat >> "$manifest_file" << FOOTER
  ],
  "summary": {
    "total": $total,
    "permissive": $permissive_count,
    "copyleft": $copyleft_count,
    "unknown": $unknown_count
  }
}
FOOTER

    log_info "MANIFEST.json generated with $total repos"
}

# Main execution
main() {
    log_info "Starting reference repo sync..."
    
    create_directories
    
    local failed=0
    for repo_entry in "${REPOS[@]}"; do
        IFS='|' read -r domain name url <<< "$repo_entry"
        process_repo "$domain" "$name" "$url" || ((failed++))
    done
    
    generate_manifest
    
    if [ $failed -gt 0 ]; then
        log_warn "$failed repos failed to clone/update"
        exit 1
    else
        log_info "All repos synced successfully!"
    fi
}

main "$@"
