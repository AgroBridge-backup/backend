#!/bin/bash
set -e
echo "Scanning bilingual documentation for staleness..."

# Check if running on macOS or Linux for stat syntax
if [[ "$OSTYPE" == "darwin"* ]]; then
    STAT_CMD="stat -f %m"
else
    STAT_CMD="stat -c %Y"
fi

EXIT_CODE=0

for en_file in docs/en/*.md; do
  # Check if files exist to avoid loop error on empty dir
  [ -e "$en_file" ] || continue
  
  filename=$(basename "$en_file")
  es_file="docs/es/$filename"
  
  if [ -f "$es_file" ]; then
    en_date=$($STAT_CMD "$en_file")
    es_date=$($STAT_CMD "$es_file")
    
    # Calculate difference in days
    diff_seconds=$((en_date - es_date))
    
    # If en is newer than es by more than 7 days (604800 seconds)
    if [ $diff_seconds -gt 604800 ]; then
      days=$((diff_seconds / 86400))
      echo "❗ ALERT: $es_file is out-of-sync by $days days! Reference: $en_file"
      EXIT_CODE=1
    fi
  else
    echo "❗ MISSING: $es_file (needs translation for $en_file)"
    EXIT_CODE=1
  fi
done

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Bilingual synchronization check passed."
fi

exit $EXIT_CODE
