# Worklenz Backend (MongoDB)

Express backend powered by MongoDB/Mongoose.

## Requirements

- Node.js 20+
- MongoDB 7+ (or Docker Compose service)

## Local Run

```bash
cd backend
cp .env.template .env
npm install
npm run dev
```

Backend starts on `http://localhost:3000` by default.

## Environment

Required variables:

- `MONGO_URI`
- `JWT_SECRET`
- `SESSION_SECRET`
- `COOKIE_SECRET`

## Scripts

- `npm run dev` - start with nodemon
- `npm start` - start server
- `npm test` - run tests
