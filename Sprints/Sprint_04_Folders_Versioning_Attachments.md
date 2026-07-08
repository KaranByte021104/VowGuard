# Sprint 4 — Folders, Versioning & Attachments

**Goal:** Round out the individual-vault experience beyond a flat list of secrets — organizing secrets into folders, keeping a safety net of previous values through version history, allowing files to be attached to a secret, and letting a user get their own data back out through export. By the end of this sprint, the single-user experience of the product is essentially feature-complete; sharing and collaboration begin in Sprint 5.

**Reference:** TRD Sections 2.3 (Folders), 9.2 (folders, secret_shares reference), 9.6 (File Attachments & Secret Versioning), 9.7 (Local File Storage), FR-9, FR-11, FR-11A, FR-12 through FR-14, Section 8.1 (file-size validation).

---

## Scope

### 1. Database schema — folders, file attachments, secret versions

Build out the `folders` table (self-referencing `parent_folder_id`, enabling arbitrary nesting depth) and the `folder_secrets` junction table, per Section 9.2. Build out `file_attachments` and `secret_versions`, per Section 9.6 — both designed to reuse the same client-side encryption model as `secrets` itself, so the server never has a plaintext code path for either file contents or historical values, only the metadata needed to list and order them.

### 2. Folder tree — creation, nesting, and management

Implement nested folders of arbitrary depth (FR-12): creating a folder, optionally as a subfolder of another, and rendering the resulting tree in the UI. Implement renaming and moving a folder, and bulk-assigning existing secrets into a new or existing folder (FR-14) so a user isn't stuck manually dragging one secret at a time when organizing an existing vault.

### 3. Folder-level sharing plumbing (structure only)

Lay the groundwork described in FR-13 and BR-8 — sharing a folder applies a single permission level to every secret currently inside it, and secrets added afterward do not automatically inherit that permission. The actual cross-user sharing mechanics (recipient resolution, re-encryption) are Sprint 5's job, but the folder-side data model and the "applies to current contents only, not future additions" rule belong here, since they're a folder concern first and a sharing concern second.

### 4. Secret version history

Implement FR-11A: every update to a secret's value captures the previous encrypted state into `secret_versions` before the new value is applied, and this history is visible only to the secret's owner — not to a Modify or Manage collaborator, even though a collaborator with those permission levels is the one who might have made the change. Implement listing the version history and restoring a prior version, so an unwanted change (by the owner or by a collaborator) can be reviewed and reverted.

### 5. File attachments

Implement FR-9: attaching a file to a secret, encrypted client-side with the same session-derived key used for the secret itself, before upload. Wire this to the local-filesystem storage pattern from Section 9.7 — the encrypted blob is stored under a non-web-accessible directory, named by a random UUID rather than the original filename, with only `file_attachments.encrypted_blob_path` holding the mapping. Enforce the 10 MB per-file limit from Section 8.1, with the specified error message on rejection. Implement downloading and client-side decrypting an attachment, mirroring the secret-retrieval pattern from Sprint 3.

### 6. Password export

Implement FR-11: exporting a user's own passwords, gated by whatever Fine-Grained Control restrictions exist for that user (the Fine-Grained Controls admin surface itself is built in Sprint 10, but the export endpoint should already respect a permission check here so it isn't retrofitted later). Per the TRD's v1.3 decision, the user chooses CSV or JSON as the output format at export time, and — consistent with zero-knowledge — the server only ever returns ciphertext; the client decrypts locally and generates the downloadable file itself, so plaintext is never produced server-side.

---

## Deliverables

- Migrated `folders`, `folder_secrets`, `file_attachments`, and `secret_versions` tables.
- A working nested folder tree: create, rename, move, delete, bulk-assign.
- Folder-level permission-application data model (sharing mechanics deferred to Sprint 5).
- Version history: automatic snapshot on update, owner-only visibility, list and restore.
- File attachments: client-side encrypted upload, 10 MB limit enforcement, encrypted local storage, client-side decrypted download.
- Password export in the user's choice of CSV or JSON, generated client-side from decrypted data.

## Acceptance criteria

- A user can create nested folders several levels deep and see the correct tree structure.
- Bulk-assigning ten existing secrets into a folder correctly associates all ten without requiring one-by-one action.
- Editing a secret's password three times produces three retrievable prior versions, visible only to the owner — a Modify-permission collaborator (once sharing exists in Sprint 5) should not see this history.
- Restoring an older version correctly reverts the secret's current value.
- Attaching a file under 10 MB succeeds and can be downloaded and correctly decrypted back to its original contents; attaching a file over the limit is rejected with the specified error.
- Direct inspection of the attachment storage directory shows only encrypted blobs named by random UUID — never an original filename or plaintext content.
- Exporting a vault produces a correctly formatted CSV or JSON file (per the user's choice) containing the expected plaintext values, generated without the server ever having access to that plaintext.

## Explicitly out of scope for this sprint

- Actual cross-user secret and folder sharing (individual, group, third-party) — Sprint 5.
- Fine-Grained Controls admin configuration UI — Sprint 10 (this sprint only needs the export endpoint to already check for a restriction).
- Access Control (request-release workflow) — Sprint 6.

---

*Next: Sprint 5 — Sharing & RBAC.*
