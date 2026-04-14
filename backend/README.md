# Worklenz Backend - High-Availability Architecture

Welcome to the modernized Worklenz Backend. This platform has been architecturally hardened to support enterprise-grade security, scalability, and observability.

## 🏗️ Modern Architecture (`src-new/`)

The core logic resides in the `src-new/` directory, following a clean **Controller-Service-Model** separation:
- **Controllers**: Handle HTTP routing and request parsing.
- **Services**: Contain all core business logic (Testable & Reusable).
- **Models**: High-performance MongoDB schemas with optimized indexing.

## 🛡️ Security Hardening
- **CSRF Protection**: Stateful session-based tokens for all state-changing operations.
- **XSS Mitigation**: Integrated `sanitize-html` and client-side sanitization.
- **Rate Limiting**: Intelligent limiting for Auth and general API endpoints.
- **Password Policies**: Strict entropy requirements for user safety.

## ⚡ Performance Features
- **N+1 Optimization**: Batch aggregation pipelines for complex reporting.
- **Unified Caching**: Redis-ready caching layer with in-memory fallbacks.
- **Compound Indexing**: Database tuned for high-density reporting queries.

## 📊 Observability
- **Request Tracing**: Unique `X-Request-ID` headers for end-to-end logging.
- **API Documentation**: Interactive OpenAPI 3.0 specs available at `/api-spec.json`.
- **Structured Logging**: Winston-powered logging with correlation IDs.

---

## 🚀 Getting Started

### Development
```bash
npm install
npm run dev
```

### System Diagnostics (Health Check)
Verify the health of MongoDB, Redis, S3, and Email services:
```bash
npm run health
```

### Maintenance & Admin
Access the Worklenz Admin Toolkit:
```bash
npm run admin          # Lists all available commands
npm run admin <cmd>    # Executes a specific maintenance script
```

## 🐳 Deployment
The platform is fully containerized with an optimized multi-stage `Dockerfile`:
```bash
docker build -t worklenz-backend .
docker run -p 3000:3000 --env-file .env worklenz-backend
```
