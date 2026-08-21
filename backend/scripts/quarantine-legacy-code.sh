#!/usr/bin/env bash
# Moves (does NOT delete) every unmounted route file and every pre-Prisma
# Firestore-model wrapper class out of backend/src, into backend/_legacy-archive/.
#
# Why "move" and not "delete": git history preserves deleted files fine, but
# this keeps the migration reversible for a week or two without needing to
# dig through git log if it turns out one of these 30 modules was quietly
# load-bearing somewhere I didn't grep for. Delete the archive folder for
# good once your team has confirmed nothing broke.
#
# Run from backend/ directory:
#   bash scripts/quarantine-legacy-code.sh
#
# Safe to re-run; skips anything already moved.

set -euo pipefail

SRC="src"
ARCHIVE="_legacy-archive"

mkdir -p "$ARCHIVE/routes" "$ARCHIVE/models" "$ARCHIVE/controllers"

# --- 1. Unmounted route files (confirmed via app.js — none of these are
#        imported/mounted anywhere in the running app as of this audit) ---
UNMOUNTED_ROUTES=(
  abdm ambulance analytics audit bloodbank chat chatModels
  customizationRequests directorAdmins directorStats doctorApplications
  doctorAttendance doctorManagement faqs hrms leaves medicines ot
  planReceipts prescriptionTemplates public queries queue
  reports shifts staff suppliers telemedicine uploads
)
# NOTE: payments.js is deliberately excluded — see the note at the bottom
# of this script. It needs a human decision, not an automatic move.

echo "== Quarantining unmounted route files =="
for name in "${UNMOUNTED_ROUTES[@]}"; do
  f="$SRC/routes/$name.js"
  if [ -f "$f" ]; then
    git mv "$f" "$ARCHIVE/routes/$name.js" 2>/dev/null || mv "$f" "$ARCHIVE/routes/$name.js"
    echo "  moved routes/$name.js"
  fi
done

# --- 2. Pre-Prisma Firestore-model wrapper classes (backend/src/models/*.js,
#        NOT backend/src/models/firestore/ — that's the wrapper base class
#        itself, which some legacy files still import; leave it in place
#        until every file that imports it is gone, then remove it too). ---
echo ""
echo "== Quarantining pre-Prisma Firestore model wrappers =="
if [ -d "$SRC/models" ]; then
  find "$SRC/models" -maxdepth 1 -name '*.js' -type f | while read -r f; do
    base=$(basename "$f")
    git mv "$f" "$ARCHIVE/models/$base" 2>/dev/null || mv "$f" "$ARCHIVE/models/$base"
    echo "  moved models/$base"
  done
fi

echo ""
echo "== Done =="
echo "Review $ARCHIVE/ manually, run your test suite / smoke tests, then either:"
echo "  - restore anything that turns out to still be needed (git mv back), or"
echo "  - once confirmed dead, delete $ARCHIVE/ entirely and commit."
echo ""
echo "NOT auto-moved (needs a human decision first, see CHANGES.md):"
echo "  - routes/payments.js: contains the Razorpay/Stripe webhook handler."
echo "    Confirm whether payment webhooks are expected to work before"
echo "    archiving this one — if so, it needs a Prisma-based rewrite and"
echo "    remounting in app.js instead, not quarantining."
echo "  - src/models/firestore/ (the wrapper base class) — remove only after"
echo "    confirming nothing in src/ still imports it."
