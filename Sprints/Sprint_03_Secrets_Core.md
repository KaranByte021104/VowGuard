# Sprint 3 — Secrets Core (CRUD, Templates, Generator)

**Goal:** Build the actual heart of the product — the ability to create, view, edit, and delete secrets, encrypted client-side, using the cryptography module from Sprint 1. By the end of this sprint, a logged-in user should be able to do the single most important thing a password manager does: store a credential safely and get it back.

**Reference:** TRD Sections 6.2 (Adding and Retrieving a Secret), 2.2 (Secrets Management), 9.2 (Secrets table), 12.8 (Password Strength & Breach Detection), FR-6 through FR-11, FR-6A, NFR-6.

---

## Scope

### 1. Database schema — secrets

Build out the real `secrets` table described in Section 9.2: owner, template type, name and domain left unencrypted (needed for search/list rendering and extension autofill matching later), and the encrypted payload itself (ciphertext, IV, auth tag) holding username/password/notes/custom fields. Include the `is_personal` and `access_control_enabled` flags now, even though the features that act on them (personal-secret restrictions, Access Control) arrive in later sprints — this avoids a disruptive schema change once those sprints begin.

### 2. Secret creation with client-side encryption

Implement the "Add a secret" flow from Section 6.2: the user picks a template (Website/Login, Server, Unix, Windows, License Key, Custom — FR-6), fills in the fields, and on save, the client encrypts everything sensitive using the cryptography module from Sprint 1 before anything is sent to the server. The server only ever receives and stores ciphertext, IV, and auth tag — never a plaintext field, matching the zero-knowledge guarantee this whole project is built around.

### 3. Secret retrieval and decryption

Implement the "Retrieve a secret" flow: fetching the encrypted record, decrypting it in-memory using the session key, and rendering plaintext only in the browser — never logging it, never caching it to disk. Also implement the masked-by-default display rule from Section 13.1 — a secret's value renders hidden until the user explicitly reveals or copies it, so nothing sensitive is ever shown by accident.

### 4. Update and delete

Implement editing an existing secret (re-encrypt the changed fields client-side, same as creation) and deleting one, with the confirmation-before-destructive-action pattern required by NFR-12 applied to deletion specifically.

### 5. Password generator and strength scoring

Implement the password generator (FR-7): configurable length and character-set rules, generating a strong random value the user can drop straight into the password field. Alongside it, wire up client-side strength scoring using zxcvbn as the user types (Section 12.8), so weak values are flagged before the secret is ever saved — this is purely advisory at this stage, since the full Password Policy engine that can reject a save outright is a Sprint 3 follow-on described below.

### 6. Password Policy definition (data model and validation logic)

Implement the Password Policy engine itself (FR-38): admins can define named policies (minimum/maximum length, character-composition rules, recycle interval) and set one as the organization default. Build the validation logic that checks a candidate password against the active policy and produces the specific-rule error message described in Section 8.1 — but note this validation, like everything else in this sprint, runs entirely client-side before encryption, consistent with the zero-knowledge trade-off documented in Section 12.10. Wiring this policy check into the actual secret-save path happens as part of this sprint too, so a policy-violating password is rejected with the correct error before it's ever encrypted.

### 7. Site catalog for quick-add

Build the small, static ~30-entry site catalog described in FR-6A (Google, GitHub, AWS, Slack, and similar well-known services, each with a name, icon, and default URL) and wire it into the Add Secret flow so selecting a catalog entry auto-fills the name and icon, leaving the user to just supply credentials.

### 8. CSV and browser import

Implement bulk import (FR-10): accepting a CSV or common-browser export file, parsing each row client-side, and encrypting it exactly as if it had been entered manually through the Add Secret form — the server must never receive plaintext import data, even transiently, so this has to be a client-side parse-then-encrypt-then-upload pipeline rather than a server-side file upload.

---

## Deliverables

- A real, migrated `secrets` table.
- Full create/read/update/delete for secrets, all encryption and decryption happening client-side.
- A working password generator with configurable rules.
- Client-side password strength scoring (zxcvbn) surfaced in the Add/Edit Secret UI.
- A working Password Policy engine: definition, organization default, and enforcement at save time.
- The static site catalog wired into quick-add.
- CSV/browser import producing correctly encrypted secrets with no plaintext ever reaching the server.

## Acceptance criteria

- A user can add a secret using any of the six templates and see it appear in their vault.
- Reopening that secret decrypts and displays the correct plaintext, matching what was entered.
- Inspecting the `secrets` table directly shows only ciphertext, IV, and auth tag for every row — never a readable field.
- Editing a secret's password and saving re-encrypts correctly; the previous value is no longer retrievable from the current record (version history itself is Sprint 4's job — this sprint just needs the current-state update to be correct).
- The password generator produces values honoring the requested length and character-set rules.
- Saving a password that violates the organization's default policy is rejected with the specific rule that failed; a compliant password saves successfully.
- Selecting a site-catalog entry correctly pre-fills name and icon.
- Importing a CSV file of sample credentials results in correctly encrypted secrets appearing in the vault, with no plaintext values ever visible in a network request during the import.
- A vault of roughly 500 secrets still loads within the 2-second target from NFR-6 (early sanity check — full performance validation isn't a dedicated sprint, but this is the first point where checking is meaningful).

## Explicitly out of scope for this sprint

- Folders, secret versioning, file attachments, and password export — Sprint 4.
- Sharing of any kind — Sprint 5.
- Access Control and the lock-indicator UI it implies — Sprint 6.
- Breach-checking against Have I Been Pwned — can be folded in here or deferred; treated as a stretch item, not a blocking deliverable, since it's additive to strength scoring rather than core CRUD.

---

*Next: Sprint 4 — Folders, Versioning & Attachments.*
