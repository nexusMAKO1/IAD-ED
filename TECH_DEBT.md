# Technical Debt

- **ID/title**: Auth — `X-Operator-Id` header is unverified
- **Description**: the ack endpoint accepts a caller-supplied `X-Operator-Id` header as `acknowledged_by` with no verification against any identity provider. Any caller can claim any identity. Acceptable for MVP demo scope; not acceptable for production.
- **Fix required before production**: real auth middleware (JWT/API key/session) validating the operator identity before it's trusted as an audit field.
- **Discovered during**: T-015-FIX
