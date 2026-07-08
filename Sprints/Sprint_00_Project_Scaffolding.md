# Sprint 0 — Project Scaffolding & Environment

**Goal:** Stand up the empty but fully wired skeleton of the project — repository structure, backend service, web application shell, and shared tooling — so that every later sprint is adding features to a working foundation rather than fighting setup issues.

**Reference:** TRD Sections 11 (High-Level System Architecture), 15 (Technology Stack), 16.2 (Constraints — native, no containers, zero-cost).

---

## Scope

### 1. Repository structure

Set up a single monorepo (per your decision) with clearly separated top-level areas for the backend service, the web application, the browser extension (scaffolded now, built out in Sprint 11), shared packages that multiple parts of the system will need in common (for example, shared TypeScript types for API request/response shapes), and a dedicated folder for the diagrams you asked for (architecture diagram and database ERD, to be filled in as those are produced). A root-level README stub is created now and expanded in the final sprint.

### 2. Backend service foundation

Initialize the backend as a modular Node.js/NestJS project, matching the architecture described in Section 11.1. At this stage this means: the project boots, responds to a basic health-check request, and has its module structure laid out (separate modules for authentication, secrets, sharing, admin, and reporting, per NFR-13's separation-of-concerns requirement) even though most of those modules are still empty shells to be filled in over the coming sprints.

Connect the backend to a local PostgreSQL instance through Prisma, matching Section 9's database design approach, and confirm the connection works with an initial, mostly-empty schema (this becomes the base that Sprint 1 adds real tables to). Also connect a local Redis instance, since several later sprints (Access Control timers, Emergency Access countdowns, Cloud Backup jobs) depend on Redis and BullMQ being available from the start, per Section 11.4.

### 3. Web application foundation

Initialize the web application as a React + TypeScript project styled with Tailwind CSS, matching Section 15.1. At this stage this means: the app builds and runs locally, shows a placeholder landing screen, and has its core navigation shell in place (the persistent left-hand navigation rail and top bar described in Section 13.3), even though none of the screens behind that navigation are functional yet.

Set up the two client-side state layers called out in Section 15.2 — one for server data caching/sync, and one for local session state — so that later sprints have a consistent pattern to build against rather than inventing state management ad hoc per feature.

### 4. Shared tooling and configuration

Establish consistent code style and linting rules across the backend and web application, so code quality stays consistent as the project grows (this supports the "clean and maintainable code" evaluation criterion). Set up an example environment-configuration file documenting every setting a future developer or evaluator will need to supply (database connection, Redis connection, email/SMTP credentials, OAuth client credentials, SAML certificate paths), per Section 11.5's native-deployment approach — without containerization, this file is the single source of truth for how the app is configured on a given machine.

Write the initial README with just enough content to get the project running locally (clone, install dependencies, configure environment, run database migrations, start both the backend and the web app) — this gets expanded into full setup documentation in the final sprint, but a minimal working version is created now so the project is runnable from day one.

### 5. Version control conventions

Establish the commit and branching approach you want to follow for the rest of the project: one feature-scoped, PR-sized commit per unit of work (per your instruction), with commit messages that describe what was built and which part of the TRD it corresponds to, so the final commit history reads as a clear record of the build process rather than a single dump.

---

## Deliverables

- A working monorepo skeleton, committed with an initial scaffolding commit.
- A backend service that starts, connects to PostgreSQL and Redis, and responds to a health check.
- A web application that starts and renders a basic navigation shell.
- A documented environment-configuration example file.
- A minimal, accurate README covering local setup only.

## Acceptance criteria

- A developer who has never seen the project can clone the repository, follow the README, and get both the backend and the web app running locally without needing to ask a question.
- The backend successfully talks to both PostgreSQL and Redis on startup.
- The repository structure matches the module boundaries described in the TRD (auth, secrets, sharing, admin, reporting as distinct backend modules; a clear separation between web app and extension).

## Explicitly out of scope for this sprint

- Any real authentication, secrets, sharing, or other functional logic — that begins in Sprint 1.
- The browser extension's actual functionality (only its folder/package scaffold is touched here, if at all).
- Any UI screen beyond the empty navigation shell.
- Deployment/hosting setup beyond local, native execution.

---

*Next: Sprint 1 — Core Identity & Cryptography Foundation.*
