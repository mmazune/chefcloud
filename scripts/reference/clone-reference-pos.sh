#!/bin/bash
# Clone or update reference POS repositories
# Usage: ./scripts/reference/clone-reference-pos.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Resolve repo root (script can be run from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REFERENCE_DIR="$REPO_ROOT/reference-pos"

echo -e "${GREEN}=== Nimbus POS - Reference Repos Sync ===${NC}"
echo "Repo root: $REPO_ROOT"
echo "Reference dir: $REFERENCE_DIR"
echo ""

# Create reference-pos if missing
if [ ! -d "$REFERENCE_DIR" ]; then
  echo -e "${YELLOW}Creating reference-pos directory...${NC}"
  mkdir -p "$REFERENCE_DIR"
fi

cd "$REFERENCE_DIR"

# Array of repos to clone/update
declare -A REPOS=(
  ["opensourcepos"]="https://github.com/opensourcepos/opensourcepos.git"
  ["nexopos"]="https://github.com/Blair2004/NexoPOS.git"
  ["pos-awesome"]="https://github.com/ucraft-com/POS-Awesome.git"
  ["medusa-pos-starter"]="https://github.com/Agilo/medusa-pos-starter.git"
  ["medusa-pos-react"]="https://github.com/pavlotsyhanok/medusa-pos-react.git"
  ["store-pos"]="https://github.com/tngoman/Store-POS.git"
)

# Clone or update each repo
for repo_name in "${!REPOS[@]}"; do
  repo_url="${REPOS[$repo_name]}"
  
  if [ -d "$repo_name" ]; then
    echo -e "${YELLOW}[$repo_name]${NC} Updating existing repo..."
    (
      cd "$repo_name"
      git fetch --all --prune
      if git pull --ff-only 2>/dev/null; then
        echo -e "${GREEN}[$repo_name]${NC} Updated successfully"
      else
        echo -e "${YELLOW}[$repo_name]${NC} Fast-forward failed, repo may have diverged (OK for shallow clones)"
      fi
    )
  else
    echo -e "${YELLOW}[$repo_name]${NC} Cloning from $repo_url..."
    if git clone --depth 1 "$repo_url" "$repo_name"; then
      echo -e "${GREEN}[$repo_name]${NC} Cloned successfully"
    else
      echo -e "${RED}[$repo_name]${NC} Clone failed!"
      exit 1
    fi
  fi
  echo ""
done

# Generate MANIFEST.json
echo -e "${YELLOW}Generating MANIFEST.json...${NC}"

cat > MANIFEST.json <<'EOF'
{
  "generated": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'",
  "purpose": "Reference POS repositories for architecture pattern study - DO NOT COPY CODE without license review",
  "repositories": [
EOF

first=true
for repo_name in opensourcepos nexopos pos-awesome medusa-pos-starter medusa-pos-react store-pos; do
  if [ ! -d "$repo_name" ]; then
    echo -e "${RED}Warning: $repo_name directory not found, skipping...${NC}"
    continue
  fi
  
  cd "$repo_name"
  
  # Extract metadata
  url=$(git config --get remote.origin.url)
  commit=$(git rev-parse HEAD)
  branch=$(git rev-parse --abbrev-ref HEAD)
  default_branch=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | sed 's/.*: //' || echo "$branch")
  
  # Detect license file (case-insensitive)
  license_file=""
  license_type="UNKNOWN"
  for pattern in LICENSE LICENSE.md LICENSE.txt COPYING COPYING.txt license.txt; do
    if [ -f "$pattern" ]; then
      license_file="$pattern"
      break
    fi
  done
  
  # Extract license type from first lines
  if [ -n "$license_file" ]; then
    license_content=$(head -n 5 "$license_file")
    if echo "$license_content" | grep -qi "MIT License"; then
      license_type="MIT"
    elif echo "$license_content" | grep -qi "GNU GENERAL PUBLIC LICENSE"; then
      if echo "$license_content" | grep -qi "Version 3"; then
        license_type="GPL-3.0"
      else
        license_type="GPL"
      fi
    elif echo "$license_content" | grep -qi "Apache License"; then
      license_type="Apache-2.0"
    fi
  fi
  
  # Determine notes
  notes=""
  case "$repo_name" in
    opensourcepos)
      notes="PHP/CodeIgniter POS - MIT license, safe for reference and inspiration"
      ;;
    nexopos)
      notes="Laravel/Vue POS - GPL-3.0 (COPYLEFT WARNING: reference only, do not copy code)"
      ;;
    pos-awesome)
      notes="Frappe/ERPNext POS - GPL-3.0 (COPYLEFT WARNING: reference only, do not copy code)"
      ;;
    medusa-pos-starter)
      notes="Medusa.js POS starter - MIT license, safe for reference and inspiration"
      ;;
    medusa-pos-react)
      notes="React Medusa POS - No license file found, assume proprietary/all rights reserved"
      ;;
    store-pos)
      notes="Laravel POS - No license file found, assume proprietary/all rights reserved"
      ;;
  esac
  
  # Add comma between entries
  if [ "$first" = false ]; then
    echo "," >> ../MANIFEST.json
  fi
  first=false
  
  # Write JSON entry
  cat >> ../MANIFEST.json <<ENTRY
    {
      "name": "$repo_name",
      "url": "$url",
      "defaultBranch": "$default_branch",
      "commit": "$commit",
      "licenseFile": "$license_file",
      "licenseType": "$license_type",
      "notes": "$notes"
    }
ENTRY
  
  cd ..
done

# Close JSON
cat >> MANIFEST.json <<'EOF'

  ],
  "warnings": {
    "GPL_REPOS": ["nexopos", "pos-awesome"],
    "COPYLEFT_NOTICE": "GPL-3.0 licensed repos (nexopos, pos-awesome) require derivative works to also be GPL-3.0. DO NOT COPY CODE from these repos into Nimbus POS unless we release Nimbus as GPL-3.0. Use for architecture study and design inspiration only.",
    "UNKNOWN_LICENSE_REPOS": ["medusa-pos-react", "store-pos"],
    "UNKNOWN_LICENSE_NOTICE": "Repos without license files should be assumed to be proprietary/all rights reserved. Do not copy any code from these repos."
  }
}
EOF

echo -e "${GREEN}MANIFEST.json generated successfully${NC}"
echo ""

# Summary
echo -e "${GREEN}=== Summary ===${NC}"
echo "Reference repos synced to: $REFERENCE_DIR"
echo ""
echo "Repos:"
for repo_name in "${!REPOS[@]}"; do
  if [ -d "$repo_name" ]; then
    cd "$repo_name"
    commit_short=$(git rev-parse --short HEAD)
    echo -e "  ${GREEN}✓${NC} $repo_name @ $commit_short"
    cd ..
  else
    echo -e "  ${RED}✗${NC} $repo_name (missing)"
  fi
done
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review MANIFEST.json for license information"
echo "  2. Read README.md for usage guidelines"
echo "  3. Study architecture patterns (do not copy GPL code)"
echo ""
echo -e "${GREEN}Done!${NC}"
