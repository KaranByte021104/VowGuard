# SecureVault REST API Documentation

This document covers the REST API endpoints available in the SecureVault backend.

All routes are prefixed with `/api` (except `/health` if applicable). Authenticated endpoints require a Bearer token in the `Authorization` header:
`Authorization: Bearer <JWT_TOKEN>`

---

## Table of Contents
1. [Authentication Endpoints](#1-authentication-endpoints)
2. [Users & Profiles Endpoints](#2-users--profiles-endpoints)
3. [Secrets Endpoints](#3-secrets-endpoints)
4. [Folders Endpoints](#4-folders-endpoints)
5. [Sharing Endpoints](#5-sharing-endpoints)
6. [Groups Endpoints](#6-groups-endpoints)
7. [SSO Endpoints](#7-sso-endpoints)
8. [Policies Endpoints](#8-policies-endpoints)
9. [Reports & Audit Endpoints](#9-reports--audit-endpoints)
10. [Emergency Access Endpoints](#10-emergency-access-endpoints)
11. [Backup Endpoints](#11-backup-endpoints)
12. [Attachments Endpoints](#12-attachments-endpoints)

---

## 1. Authentication Endpoints

### 1. Register User
Registers a new user or organization admin.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/register`
- **Authentication**: None

### 2. Login User
Authenticates a user and issues access/refresh tokens.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/login`
- **Authentication**: None

### 3. Verify MFA
Verifies a Time-based One-Time Password (TOTP) code during login.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/mfa/verify`
- **Authentication**: Pre-auth token

### 4. Setup MFA
Generates a TOTP secret for the authenticated user to set up their authenticator app.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/mfa/setup`
- **Authentication**: Required (JWT)

### 5. Refresh Session
Exchanges a valid refresh token for a new access token.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/refresh`
- **Authentication**: None

### 6. Logout
Invalidates the current session.
- **HTTP Method**: `POST`
- **Path**: `/api/auth/logout`
- **Authentication**: Required (JWT)

---

## 2. Users & Profiles Endpoints

### 1. Get Current Profile
Retrieves the logged-in user's profile and organization details.
- **HTTP Method**: `GET`
- **Path**: `/api/users`
- **Authentication**: Required (JWT)

### 2. Update Profile
Updates user information.
- **HTTP Method**: `PATCH`
- **Path**: `/api/users/profile`
- **Authentication**: Required (JWT)

### 3. Change Password
Changes the user's master password (requires re-encrypting vault keys).
- **HTTP Method**: `POST`
- **Path**: `/api/users/change-password`
- **Authentication**: Required (JWT)

### 4. Upload Profile Picture
- **HTTP Method**: `POST`
- **Path**: `/api/users/profile-picture`
- **Authentication**: Required (JWT)

### 5. Enforce MFA (Organization)
Allows an organization admin to enforce MFA for all users.
- **HTTP Method**: `PATCH`
- **Path**: `/api/users/organization/enforce-mfa`
- **Authentication**: Required (JWT, Admin Role)

### 6. Invite User
Sends an email invitation to join the organization.
- **HTTP Method**: `POST`
- **Path**: `/api/invitations`
- **Authentication**: Required (JWT, Admin Role)

---

## 3. Secrets Endpoints

### 1. Create Secret
Creates a new encrypted secret (password, secure note, etc.).
- **HTTP Method**: `POST`
- **Path**: `/api/secrets`
- **Authentication**: Required (JWT)

### 2. List Secrets
Retrieves a list of secrets accessible by the user (decryption happens client-side).
- **HTTP Method**: `GET`
- **Path**: `/api/secrets`
- **Authentication**: Required (JWT)

### 3. Get Secret Details
Retrieves encrypted details of a specific secret.
- **HTTP Method**: `GET`
- **Path**: `/api/secrets/:id`
- **Authentication**: Required (JWT)

### 4. Delete Secret
Deletes a specific secret.
- **HTTP Method**: `DELETE`
- **Path**: `/api/secrets/:id`
- **Authentication**: Required (JWT)

### 5. Get Secret Versions
Retrieves version history for a secret.
- **HTTP Method**: `GET`
- **Path**: `/api/secrets/:id/versions`
- **Authentication**: Required (JWT)

### 6. Restore Secret Version
Restores a secret to a previous version.
- **HTTP Method**: `POST`
- **Path**: `/api/secrets/:id/versions/:versionId/restore`
- **Authentication**: Required (JWT)

### 7. Export Secrets
Exports all accessible secrets.
- **HTTP Method**: `GET`
- **Path**: `/api/secrets/export`
- **Authentication**: Required (JWT)

---

## 4. Folders Endpoints

### 1. Create Folder
Creates a new folder to organize secrets.
- **HTTP Method**: `POST`
- **Path**: `/api/folders`
- **Authentication**: Required (JWT)

### 2. List Folders
Retrieves the user's folder hierarchy.
- **HTTP Method**: `GET`
- **Path**: `/api/folders`
- **Authentication**: Required (JWT)

### 3. Get Folder
- **HTTP Method**: `GET`
- **Path**: `/api/folders/:id`
- **Authentication**: Required (JWT)

### 4. Delete Folder
- **HTTP Method**: `DELETE`
- **Path**: `/api/folders/:id`
- **Authentication**: Required (JWT)

---

## 5. Sharing Endpoints

### 1. Share Secret Internally
Shares a secret with a user or group within the organization.
- **HTTP Method**: `POST`
- **Path**: `/api/shares/internal`
- **Authentication**: Required (JWT)

### 2. Share with Group
- **HTTP Method**: `POST`
- **Path**: `/api/shares/group`
- **Authentication**: Required (JWT)

### 3. Revoke Share
- **HTTP Method**: `DELETE`
- **Path**: `/api/shares/:id`
- **Authentication**: Required (JWT)

### 4. Create External Share (One-Time Link)
Creates a secure link to share a secret with an external user.
- **HTTP Method**: `POST`
- **Path**: `/api/shares/invite`
- **Authentication**: Required (JWT)

### 5. Access External Share
Retrieves the encrypted secret data using the external token.
- **HTTP Method**: `GET`
- **Path**: `/api/shares/external/:tokenHash`
- **Authentication**: None

---

## 6. Groups Endpoints

### 1. Create Group
Creates a user group for role-based access control.
- **HTTP Method**: `POST`
- **Path**: `/api/groups`
- **Authentication**: Required (JWT, Admin Role)

### 2. List Groups
- **HTTP Method**: `GET`
- **Path**: `/api/groups`
- **Authentication**: Required (JWT)

### 3. Add User to Group
- **HTTP Method**: `POST`
- **Path**: `/api/groups/:id/members`
- **Authentication**: Required (JWT, Admin Role)

### 4. Remove User from Group
- **HTTP Method**: `DELETE`
- **Path**: `/api/groups/:id/members/:userId`
- **Authentication**: Required (JWT, Admin Role)

---

## 7. SSO Endpoints

### 1. Setup SSO App (SAML/OIDC)
- **HTTP Method**: `POST`
- **Path**: `/api/sso/apps`
- **Authentication**: Required (JWT, Admin Role)

### 2. List SSO Apps
- **HTTP Method**: `GET`
- **Path**: `/api/sso/apps`
- **Authentication**: Required (JWT)

### 3. SSO Login (Service Provider Initiated)
- **HTTP Method**: `POST`
- **Path**: `/api/sso/login-sp/:orgId`
- **Authentication**: None

---

## 8. Policies Endpoints

### 1. Create Policy
Defines a security policy (e.g., password complexity, IP restrictions).
- **HTTP Method**: `POST`
- **Path**: `/api/policies`
- **Authentication**: Required (JWT, Admin Role)

### 2. List Policies
- **HTTP Method**: `GET`
- **Path**: `/api/policies`
- **Authentication**: Required (JWT, Admin Role)

### 3. Delete Policy
- **HTTP Method**: `DELETE`
- **Path**: `/api/policies/:id`
- **Authentication**: Required (JWT, Admin Role)

---

## 9. Reports & Audit Endpoints

### 1. Get Organization Activity Logs
Retrieves immutable audit logs for the organization.
- **HTTP Method**: `GET`
- **Path**: `/api/reports/activity-logs`
- **Authentication**: Required (JWT, Admin Role)

### 2. User Access Report
- **HTTP Method**: `GET`
- **Path**: `/api/reports/user-access`
- **Authentication**: Required (JWT, Admin Role)

### 3. Password Assessment Report
- **HTTP Method**: `GET`
- **Path**: `/api/reports/password-assessment`
- **Authentication**: Required (JWT, Admin Role)

### 4. Export Reports
- **HTTP Method**: `GET`
- **Path**: `/api/reports/export`
- **Authentication**: Required (JWT, Admin Role)

---

## 10. Emergency Access Endpoints

### 1. Request Emergency Access
Requests access to another user's vault in an emergency scenario.
- **HTTP Method**: `POST`
- **Path**: `/api/emergency-access/request`
- **Authentication**: Required (JWT)

### 2. Approve Emergency Request
- **HTTP Method**: `POST`
- **Path**: `/api/emergency-access/:id/approve`
- **Authentication**: Required (JWT)

---

## 11. Backup Endpoints

### 1. Initiate Cloud Backup
Triggers an encrypted backup of the vault to a configured cloud provider.
- **HTTP Method**: `POST`
- **Path**: `/api/backup/trigger`
- **Authentication**: Required (JWT, Admin Role)

---

## 12. Attachments Endpoints

### 1. Upload Attachment
Uploads a secure, encrypted file attached to a secret.
- **HTTP Method**: `POST`
- **Path**: `/api/attachments`
- **Authentication**: Required (JWT)
- **Headers**: `Content-Type: multipart/form-data`

### 2. Download Attachment
- **HTTP Method**: `GET`
- **Path**: `/api/attachments/:id`
- **Authentication**: Required (JWT)
