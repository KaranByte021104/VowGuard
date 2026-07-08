# Project Skeleton

This repository contains the scaffolded code for Sprint 0.

## Prerequisites
- Node.js (v20+)
- PostgreSQL (running locally)
- Redis (running locally)

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy the example environment file and update placeholders as needed.
   ```bash
   cp .env.example .env
   ```

3. **Database Setup:**
   Make sure PostgreSQL is running and you have created the database specified in your `.env`.
   ```bash
   npm run prisma:generate -w @app/backend
   npm run prisma:migrate:dev -w @app/backend
   ```

4. **Start the backend:**
   ```bash
   npm run start:dev -w @app/backend
   ```

5. **Start the web app:**
   ```bash
   npm run dev -w @app/web
   ```
