# Sprint 2 — Session, MFA & Account Management

**Goal:** Round out account-level functionality so a real organization can operate day to day: sessions renew silently instead of forcing constant re-login, users can protect their accounts with MFA, forgotten login passwords can be recovered safely, and new users can actually be invited into an existing organization rather than only being able to create one from scratch.

**Reference:** TRD Sections 6.9 (MFA Setup), 6.10 (Login Password Reset), 6.11 (Session Refresh), FR-3, FR-4, FR-5, FR-5A, BR-4, NFR-9, Section 12.3, Section 12.11.

---

## Scope

### 1. Session refresh with rotation

Build out the full silent-renewal cycle described in Section 6.11: a 15-minute access token and a 7-day refresh token, both issued as httpOnly cookies (established in Sprint 1), with the refresh endpoint rotating the refresh token on every use — issuing a new one and invalidating the old one — so a stolen, already-used refresh token cannot be replayed. Implement the reuse-detection behavior from Section 8.3: if an already-rotated refresh token is submitted again, treat it as a possible theft signal and revoke every refresh token issued to that user, forcing a full re-login, and log this as a distinct security event.

Also implement the broader revocation rule from Section 6.11: logout, password reset, and role change must all revoke every refresh token issued to that user, not just the one in use — so those actions actually end every active session everywhere, not just the current tab.

### 2. Multi-factor authentication

Implement TOTP-based MFA per Section 6.9: generating a TOTP secret, presenting it as a scannable QR code, and requiring the user to confirm setup with a live 6-digit code before MFA is marked active. Implement Email OTP as the second supported method (FR-3), giving users a choice between an authenticator app and an emailed one-time code.

Once either method is active, wire MFA into the login flow itself: after login-password verification succeeds, the user is prompted for their MFA code, and only a valid code results in a session token being issued (matching the "Temp token" auth requirement on the MFA-verify endpoint). Also implement organization-wide MFA enforcement (FR-4) — an admin-level toggle that requires every member to have MFA enabled, checked at login time.

### 3. Login password reset

Implement the reset flow from Section 6.10: a user requests a reset via their email, the server always returns the same response regardless of whether that email exists (to avoid confirming account existence), a single-use time-boxed token is emailed, and using it sets a new login password and immediately invalidates the token. Tie this into the session-revocation rule above — a successful reset must invalidate every existing session for that account, requiring re-login everywhere.

This sprint is also where the distinction in FR-5A becomes concrete in the implementation: confirm and, if useful, surface in the UI that this reset only ever touches account access — it has no effect on the Master Password, the user's keypair, or any encrypted secret, since the login password never participates in encryption (BR-1).

### 4. Organization invitations and onboarding for invited users

Implement the invite side of account management (FR-5, FR-19): an Admin or Super Admin can invite a user by email, that user receives an invitation, and — per BR-4 — does not consume an active seat until they accept and complete their own Master Password setup. This means extending the onboarding flow from Sprint 1 to support a second entry path: instead of "create a new organization," an invited user's signup flow joins an existing organization, still goes through the same explicit Master Password acknowledgement and client-side key generation as a first-time Super Admin, and ends with their own independent keypair — never a copy of anyone else's.

Also implement the corresponding admin-side actions: deactivating and removing users (FR-19), with removal cleanly handling whatever that user owned or had standing access to at a basic level (deeper cascade behavior for shared secrets specifically is handled once sharing exists, in Sprint 5).

---

## Deliverables

- Rotate-on-use refresh token flow with reuse detection and full-session revocation on logout/reset/role-change.
- TOTP and Email OTP MFA, both selectable per user, plus organization-wide MFA enforcement.
- A complete, secure login password reset flow, decoupled from Master Password/encryption state.
- Invite-based onboarding for joining an existing organization, alongside the original create-organization flow from Sprint 1.
- Admin actions to invite, deactivate, and remove users.

## Acceptance criteria

- A logged-in user's session renews silently in the background without requiring re-login, for as long as they remain active within the 7-day refresh window.
- Replaying an already-used refresh token revokes the entire session family for that user, and this event is recorded distinctly.
- A user can enable TOTP or Email OTP MFA and is correctly prompted for a code on subsequent logins; an org with MFA enforcement on blocks login for members without MFA configured.
- Requesting a password reset for a nonexistent email produces the same response as for a real one.
- After a password reset, all previously active sessions for that account are invalidated and require fresh login.
- An invited user can accept their invitation, set up their own Master Password and keypair, and join the organization without consuming a seat before acceptance.
- An Admin can deactivate or remove a user, and that user can no longer log in afterward.

## Explicitly out of scope for this sprint

- Anything involving secrets, folders, or sharing — Sprints 3–5.
- Resource-level sharing permissions and group management — Sprint 5.
- Fine-Grained Controls and password policy enforcement — Sprint 3 (policy) and Sprint 10 (controls).

---

*Next: Sprint 3 — Secrets Core (CRUD, Templates, Generator).*
