# Setting up development environment

## Requirements

- Node.js v20+
- MongoDB v7+
- S3-compatible storage (MinIO recommended for local)

## Installation

1. Clone repo

```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

3. Backend

```bash
cd backend
cp .env.template .env
npm install
npm run dev
```

Set `MONGO_URI` in `backend/.env` (example: `mongodb://localhost:27017/worklenz_db`).

4. Docker option (recommended)

```bash
cp .env.example .env
docker compose --profile express up -d
```

Services include MongoDB, Redis, MinIO, backend, frontend, and nginx.
