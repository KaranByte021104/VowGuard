# Sprint 5 — Sharing & RBAC

**Goal:** Turn SecureVault from a single-user vault into a genuinely collaborative platform: secrets can be shared with individual teammates, whole groups, or external third parties, each share carries a specific permission level, and organizational roles are properly enforced everywhere. This is the largest and most security-sensitive sprint in the project, since it's where the zero-knowledge model has to hold up across multiple people rather than just one.

**Reference:** TRD Sections 2.4 (Sharing), 2.5 (User, Group & Role Management), 5 (User Roles & Permissions), 6.3 (Sharing a Secret), 9.2 (secret_shares, third_party_invites), 12.2 (Key Management), FR-15 through FR-22, FR-18A, FR-18B, BR-5 through BR-9, BR-8A through BR-8C.

---

## Scope

### 1. Database schema — secret_shares, third_party_invites, user_groups

Build out `secret_shares` (Section 9.2) with its fan-out design: a share to a user is one row, and a share to a group produces one row per current member rather than a single shared-key row, per BR-8A. Build out `third_party_invites` for the external-sharing flow, and `user_groups` / `user_group_members` for the many-to-many group membership described in Section 9.1.

### 2. Individual and group sharing

Implement the owner-shares-a-secret flow from Section 6.3: the owner selects a recipient (user or group), chooses one of the four permission levels, and the client decrypts the secret locally and re-encrypts a copy for the recipient's public key. For a group, this means fetching every current member's public key and re-encrypting one copy per member (FR-18A) — creating one independently-revocable `secret_shares` row per member, with no single shared group key anywhere in the system, matching the "no form of sharing relies on a single shared key" principle from Section 12.2.

Implement the four-tier permission model itself (FR-16, Section 5.3): One-Click Login Only, View, Modify, and Manage, each unlocking a different set of actions on the shared secret. Make sure a recipient's organizational role and their resource-level sharing permission are checked independently, per Section 5.3's example — a User-role member with Manage on a specific secret can delete that secret but still can't reach Admin settings.

### 3. Group management

Implement creating User Groups and assigning members (FR-20), which the sharing flow above depends on. Implement the BR-8A rule directly: a member added to a group after a share event does not retroactively gain access to secrets already shared to that group — they only gain access to secrets shared after they joined, or if the share is explicitly redone.

### 4. Third-party (external) sharing

Implement the non-member sharing flow from Section 6.3 and FR-18B: the owner enters an external email, the server creates a pending invite and emails a single-use link (valid 72 hours, per the TRD's v1.3 decision), and no ciphertext is sent until the recipient accepts. On accept, the recipient's browser generates an ephemeral RSA keypair locally, protected by a passphrase they set at that moment — never an organization Master Password, and the recipient never becomes a member. Only once that keypair exists does the owner's client fetch the new public key, decrypt the secret locally, and re-encrypt a copy for it. Enforce BR-7 (third-party shares default to the lowest-privilege One-Click Login Only unless explicitly elevated) and BR-8B (the ephemeral keypair and passphrase are scoped to that single invite only).

### 5. Revocation

Implement revoking a share (FR-17, Section 6.3's revoke flow): deleting the corresponding `secret_shares` row and its re-encrypted copy immediately, with BR-6's rule that revocation is immediate, irreversible, and any re-share afterward is a fresh, freshly re-encrypted event — never a reactivation of the old one. Also implement BR-8C's documented limitation explicitly: removing a user from a group or the organization deletes their own standing share records immediately (blocking new access going forward) but does not retroactively re-encrypt copies already held by other remaining members — this is a known, accepted trade-off from the TRD, not a bug to be silently "fixed" mid-sprint.

### 6. Personal secrets and folder-level sharing

Implement BR-5: a secret marked Personal cannot be shared, added to a shared folder, or placed under Access Control — enforce this as a hard block at the API layer, not just a UI hint. Wire up actual folder-level sharing (FR-13) now that individual sharing mechanics exist: sharing a folder applies the chosen permission to every secret currently inside it, per BR-8, using the same per-recipient re-encryption path as an individual secret share.

### 7. Role management and resource-permission guard

Implement role changes (FR-21, FR-22): assigning Super Admin / Admin / User, requiring explicit confirmation before a change takes effect (NFR-12), and enforcing BR-9 — the system must block demoting or removing the organization's last Super Admin. Build the resource-level `SharePermissionGuard` referenced throughout the TRD's architecture sections, sitting alongside the `RolesGuard` from Sprint 1: this is what actually checks a caller's permission level on a specific secret or folder, independent of their organizational role.

---

## Deliverables

- Migrated `secret_shares`, `third_party_invites`, `user_groups`, `user_group_members` tables.
- Individual and group sharing with correct per-recipient re-encryption and fan-out.
- The four-tier permission model, enforced independently of organizational role.
- Third-party ephemeral-keypair invite flow, including the 72-hour expiry and lowest-privilege default.
- Working revocation, including the accepted BR-8C limitation on group-offboarding re-encryption.
- Personal-secret sharing restrictions enforced server-side.
- Folder-level sharing.
- Role management with the last-Super-Admin safeguard.
- A resource-level SharePermissionGuard, used alongside the existing RolesGuard.

## Acceptance criteria

- Sharing a secret with an individual results in exactly one new `secret_shares` row, correctly re-encrypted for that recipient's public key.
- Sharing a secret with a five-member group results in exactly five independently-revocable rows, and a sixth member who joins afterward does not gain access to that already-shared secret.
- A recipient with View permission can see and copy the value but cannot edit it; a recipient with Manage permission can edit, re-share, and delete it.
- Sharing with a third party by email results in no ciphertext being sent until the invite is accepted; after acceptance, the recipient can decrypt the secret using only their own passphrase.
- Revoking a share immediately removes the recipient's access, verified by a direct attempt to fetch the secret returning 404.
- Attempting to share, folder-assign, or Access-Control-protect a Personal secret is rejected at the API level even if attempted directly against the endpoint.
- Attempting to demote or remove the organization's only Super Admin is blocked with the specified conflict response.
- A User-role member with Manage permission on a specific secret can delete it, but the same user is correctly blocked from any Admin-only settings screen.

## Explicitly out of scope for this sprint

- Access Control (request-release workflow) — Sprint 6.
- Emergency Access — Sprint 7.
- Fine-Grained Controls admin UI — Sprint 10.

---

*Next: Sprint 6 — Access Control (Request-Release).*
