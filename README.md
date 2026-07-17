# SecureVault - Enterprise Password Manager

SecureVault is a zero-knowledge enterprise password manager designed to guarantee tenant isolation, immutable audit logging, and absolute cryptographic security where not even the database administrators can read the secrets.

This repository constitutes the complete submission, containing both the frontend client and the backend API.

## Project Deliverables

All documentation, diagrams, and technical requirements (TRD) have been strictly followed and can be found in the following locations:

- **Technical Requirements Document (TRD)**: Located in the `Sprints` folder or root.
- **Architecture Diagram**: [diagrams/architecture.md](diagrams/architecture.md) (Mermaid)
- **Database Entity-Relationship Diagram (ERD)**: [diagrams/erd.md](diagrams/erd.md) (Mermaid)
- **API Documentation (Swagger)**: Automatically available at `http://localhost:3000/api/docs` when the backend is running.

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** (v18+)
- **PostgreSQL** (v14+) running locally on default port 5432
- **Redis** running locally on default port 6379

### 1. Installation

Clone the repository and install dependencies from the root:
```bash
npm install
```

### 2. Environment Configuration

Ensure you have a `.env` file in the root directory containing the required secrets:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/securevault?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### 3. Database Migration & Seeding

Navigate to the backend package, run Prisma migrations, and seed the demonstration data:

```bash
cd app/packages/backend
npx prisma migrate dev
npm run seed
```

> [!IMPORTANT]
> The `npm run seed` command will provision Zylker Corp and create 4 demo accounts (Super Admin, Admin, and 2 Users). At the end of the script, the console will print the login emails and the **Demo Master Password**.

### 4. Running the Application

You can run both the frontend and backend simultaneously using the root workspace commands, or run them individually:

**Backend:**
```bash
cd app/packages/backend
npm run start:dev
```
*API runs at `http://localhost:3000`*

**Frontend Web App:**
```bash
cd app/packages/web
npm run dev
```
*Web app runs at `http://localhost:5173`*

---

## Testing

To run the automated test suite, including the tenant-isolation and security hardening tests developed in Sprint 13:

```bash
cd app/packages/backend
npm run test:e2e
```

## Reconciliations (TRD vs Implementation)
- **Security Check:** Rate limits (100 req/min global, 5/15m login) and CSRF (double-submit) are strictly implemented.
- **Data Encryption:** Argon2id is used for key derivation on the client, and all vault data is encrypted via WebCrypto (AES-GCM) prior to network transmission.
- **UI/UX Redesign:** Completed a comprehensive frontend UI/UX overhaul in Sprint 15.

---
*Built incrementally over 16 Sprints (0-15).*
