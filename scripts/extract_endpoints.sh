#!/usr/bin/env bash
# Extract endpoints from NestJS controllers

OUTPUT="reports/artifacts/inferred_endpoints.txt"
echo "# Inferred API Endpoints from Controllers" > "$OUTPUT"
echo "# Format: METHOD PATH FILE:LINE" >> "$OUTPUT"
echo "" >> "$OUTPUT"

for controller in $(find services/api/src -name "*.controller.ts"); do
  # Extract controller path from @Controller decorator
  controller_path=$(grep -E "@Controller\(" "$controller" | head -1 | sed "s/.*@Controller('\([^']*\)'.*/\1/" | sed "s/@Controller()//")
  
  # Find all HTTP method decorators
  grep -n -E "@(Get|Post|Put|Patch|Delete)\(" "$controller" | while IFS=: read -r line_num line_content; do
    method=$(echo "$line_content" | sed -E "s/.*@(Get|Post|Put|Patch|Delete).*/\1/" | tr '[:lower:]' '[:upper:]')
    route=$(echo "$line_content" | sed -E "s/.*@(Get|Post|Put|Patch|Delete)\('([^']*)'\).*/\2/" | sed "s/@.*()//")
    
    if [ -n "$controller_path" ]; then
      full_path="/$controller_path/$route"
    else
      full_path="/$route"
    fi
    
    # Clean up double slashes
    full_path=$(echo "$full_path" | sed 's#//*#/#g' | sed 's#/$##')
    
    echo "$method $full_path $controller:$line_num" >> "$OUTPUT"
  done
done

echo "Endpoints extracted to $OUTPUT"
wc -l "$OUTPUT"
