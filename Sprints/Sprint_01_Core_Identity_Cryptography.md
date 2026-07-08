# Sprint 1 — Core Identity & Cryptography Foundation

**Goal:** Establish the two things every other feature in SecureVault depends on: the real database schema for organizations and users, and the client-side cryptography module that makes the zero-knowledge architecture possible. By the end of this sprint, a new user should be able to create an organization, set up their Master Password, and log back in — with the server never seeing anything it isn't supposed to see.

**Reference:** TRD Sections 6.1 (Onboarding Flow), 9.1 (Core Identity Tables), 12.1–12.3 (Zero-Knowledge Architecture, Key Management, Authentication Security), 15.2 (Web Crypto API / Argon2id justification), NFR-1, NFR-2, NFR-5, BR-1 through BR-4.

---

## Scope

### 1. Database schema — organizations and users

Build out the real `organizations` and `users` tables described in Section 9.1, replacing the placeholder schema from Sprint 0. This includes the fields needed to support login (email, hashed login password), the fields needed to support the zero-knowledge model (public key, encrypted private key — never a plaintext or server-derivable private key), role and status enums, and MFA-related fields that will be activated in Sprint 2 but should exist in the schema now so later migrations stay incremental rather than reworking this table repeatedly.

Set up the migration process itself (per NFR-15, versioned and incremental) so that from this point forward, every schema change in every sprint is captured as its own reviewable migration rather than hand-edited.

### 2. Client-side cryptography module

Build the cryptography module that will be reused by essentially every feature for the rest of the project. This is the single most security-critical piece of the entire system, so it is built and tested in isolation, independent of any UI, before anything else depends on it.

This module needs to handle: deriving an encryption key from a user's Master Password using Argon2id (the memory-hard key-derivation decision from the TRD's v1.3 revision), generating an RSA keypair for the user, encrypting that private key with the derived key so only ciphertext ever leaves the browser, and the underlying AES-256-GCM encrypt/decrypt operations that every future secret, file attachment, and shared copy will use. Because this module underpins the zero-knowledge guarantee (NFR-1, NFR-2), it is validated with known input/output test vectors rather than just "it seems to work" — if the encryption or key derivation logic is subtly wrong, every feature built on top of it inherits that flaw.

### 3. Organization signup flow

Implement the actual new-organization-signup journey described in Section 6.1: a user enters an email and login password, confirms they're starting a new organization, chooses Teams or Personal, and is walked through Master Password creation with the explicit, un-skippable "this cannot be recovered" acknowledgement required by FR-2. On completion, the client derives the encryption key, generates the keypair, and sends only the public key and encrypted private key to the server — never the Master Password itself, never the raw private key.

This flow also creates the organization record and the first user as Super Admin (per Section 6.1, step 6), so by the end of signup the user lands on an empty dashboard ready for their first secret in a later sprint.

### 4. Login flow and session issuance

Implement login: the server verifies the login password (hashed with a memory-hard algorithm per NFR-5), and on success issues the access and refresh tokens as httpOnly, Secure, SameSite=Strict cookies per the TRD's v1.3 session-storage decision — not as anything readable by client-side JavaScript. This sprint establishes token issuance and validation; the rotate-on-use refresh behavior and explicit token lifetimes are the focus of Sprint 2, so login here can issue straightforward, correctly-scoped cookies without yet building the full refresh cycle.

Also implement the corresponding client-side unlock step: the browser prompts for the Master Password, attempts to decrypt the stored encrypted private key, and treats failure as "incorrect Master Password" without any server round-trip revealing whether the entered password was close (per Section 8.3's cryptographic error-handling table) — the server has no way to check this itself, since it never has the material to check it against.

### 5. Guard and role scaffolding

Stand up the route-level authorization guard described in Section 5.2 — a strict allow-list model where an endpoint with no explicit role requirement is open to any authenticated user, and an endpoint requiring a minimum role rejects lower-privilege callers before any business logic runs. Only the Super Admin/Admin/User role check itself is needed this sprint; the more elaborate resource-level sharing-permission guard (Section 5.3) is built in Sprint 5, once there's a "resource" (a secret) for it to guard.

### 6. CORS and cookie configuration

Configure the backend's CORS policy to the explicit origin allow-list described in the TRD's v1.3 addition (Section 12.11) — the web app's own origin, with credentials enabled — so that cookie-based sessions actually work end-to-end between the web app and the API from this sprint onward, rather than being retrofitted later. The CSRF double-submit-cookie mechanism itself is introduced alongside this, since it has to exist before any state-changing request (like signup or login) is safe to expose past local development.

---

## Deliverables

- Migrated `organizations` and `users` tables, matching Section 9.1.
- A standalone, unit-tested cryptography module (key derivation, keypair generation, AES-256-GCM encrypt/decrypt) with known-vector tests proving correctness independent of any UI.
- A working signup flow: new user → new organization → Master Password setup with acknowledgement → Super Admin account created.
- A working login flow: credential verification → session cookies issued → client-side Master Password unlock.
- Role-based route guard enforcing the Super Admin / Admin / User allow-list model.
- CORS and CSRF protections configured and active.

## Acceptance criteria

- A brand-new user can complete the full signup flow and land on an empty dashboard.
- That user can log out, log back in, enter their Master Password, and successfully unlock their account.
- Inspecting network traffic during signup and login shows the Master Password and private key are never transmitted in plaintext, satisfying the zero-knowledge check called out in Section 14.3.
- Direct inspection of the `users` table shows only a hashed login password and an encrypted private key — never anything that could reconstruct the Master Password.
- An entirely wrong Master Password fails to unlock the account, with no server round-trip that could leak information about how close the guess was.
- The cryptography module's unit tests pass against known input/output vectors.

## Explicitly out of scope for this sprint

- MFA (TOTP/Email OTP) — Sprint 2.
- Session refresh rotation and explicit token lifetime enforcement — Sprint 2.
- Login password reset — Sprint 2.
- Invited (non-first) users joining an existing organization — Sprint 2.
- Anything related to secrets, folders, or sharing — Sprints 3 onward.

---

*Next: Sprint 2 — Session, MFA & Account Management.*
