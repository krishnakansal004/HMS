import crypto from 'crypto';

// Shared by every flow that creates a user without them choosing their own
// password up front (direct doctor creation, doctor-application approval,
// and any future "admin provisions an account" flow). Both existing call
// sites generated a random password, hashed it, and then had no way to
// ever tell the new user what it was -- doctorService.createDoctor even
// has a `// TODO: Send email... with their plainPassword` comment openly
// admitting the email was never built. Emailing a raw password is also
// just bad practice regardless -- this generates a single-use, expiring
// setup token instead, exactly what users.password_reset_token /
// password_reset_expires already exist on the schema for (they were
// sitting unused -- nothing anywhere read or wrote them before this).
export function generateSetupToken() {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSetupToken(plainToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h, matches the copy already in doctorApprovalTemplate ("expire in 24 hours")
  return { plainToken, tokenHash, expiresAt };
}

export function hashSetupToken(plainToken) {
  // sha256, not bcrypt -- this is a high-entropy random token being
  // compared for exact equality, not a low-entropy user-chosen password
  // needing bcrypt's deliberate slowness. A plain deterministic hash lets
  // the lookup be a direct indexed WHERE match instead of fetching every
  // unexpired token row to bcrypt.compare against each one.
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}
