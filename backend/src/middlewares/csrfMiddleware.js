// Lightweight CSRF mitigation for the only three endpoints in this app
// that read or write a cookie: login, refresh, logout. Every other route
// authenticates via a Bearer token in the Authorization header, which a
// forged cross-site request cannot set — that's already not
// CSRF-exploitable by construction, with or without this middleware.
//
// This is deliberately NOT the double-submit-cookie pattern (csrf-csrf).
// That pattern needs a getSessionIdentifier tied to a session, and this
// app is stateless JWT with no server-side session to key off — including
// for login itself, which is exactly when no JWT exists yet. Full
// double-submit CSRF would be solving a cookie-session-riding problem
// this app's Bearer-token architecture doesn't have, at the cost of a
// real architectural mismatch (see HMS_ROADMAP.md, A1).
//
// How this works instead: a forged CSRF request — a hidden auto-submit
// <form>, an <img>/<script> tag, a bare cross-site fetch with no
// preflight — cannot attach a custom header. Only same-origin JS (or a
// CORS-preflighted request from an origin already trusted in
// ALLOWED_ORIGINS) can. Requiring this header on the three cookie-facing
// routes closes the specific gap that sameSite alone doesn't: sameSite
// governs whether a cookie is SENT on a cross-site request, not whether a
// cross-site POST can SET one — so without this, a forged cross-site
// submit to /login with attacker-controlled credentials could still plant
// an attacker's refreshToken cookie in a victim's browser. This header
// check blocks that: the forged form can't set it, so the request never
// reaches AuthController.login at all.

const CSRF_HEADER = "x-requested-with";
const CSRF_HEADER_VALUE = "xmlhttprequest"; // header values are compared lowercased

export function requireCsrfHeader(req, res, next) {
  const value = req.headers[CSRF_HEADER];
  if (!value || value.toLowerCase() !== CSRF_HEADER_VALUE) {
    const err = new Error("Missing or invalid request header.");
    err.statusCode = 403;
    return next(err);
  }
  next();
}
