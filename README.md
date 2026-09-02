# Stoclio

Stoclio is a market-intelligence platform for Indian equities. It has a Vite React frontend and an Express API with MongoDB Atlas, JWT authentication, Socket.IO streaming, and Angel One SmartAPI market data.

The product scope is market data only. It does not place orders or expose broker connection, holdings, positions, or margin APIs.

## Repository

```text
stoclio/
├── frontend/             React + Vite application
├── backend/              Express + Mongoose API
├── .github/workflows/    GitHub Actions CI
├── render.yaml           Render Blueprint
└── vercel.json           Vercel monorepo configuration
```

## Local development

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm install --prefix frontend
npm install --prefix backend
npm run dev:backend
npm run dev:frontend
```

Frontend: `http://localhost:5173`  
API health: `http://localhost:5000/health`

## Environment variables

Backend variables belong only in Render or `backend/.env`:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<at-least-32-character-secret>
CLIENT_URL=https://<your-vercel-domain>
ANGEL_API_KEY=
ANGEL_CLIENT_CODE=
ANGEL_PIN=
ANGEL_TOTP_SECRET=
ANGEL_STREAM_TOKENS={"RELIANCE":{"exchange":"nse_cm","token":"2885"}}
```

Frontend variables are safe public build-time values:

```env
VITE_API_URL=https://<your-render-domain>/api
VITE_SOCKET_URL=https://<your-render-domain>
```

Never put MongoDB, JWT, or Angel One secrets in `frontend/.env` or commit any `.env` file.

## MongoDB Atlas

1. Create a MongoDB Atlas cluster and database named `stoclio`.
2. Create a database user with access to that database.
3. Add the Render outbound IP policy required by your Atlas security posture. For initial testing, Atlas supports `0.0.0.0/0`; replace it with a restricted policy before launch.
4. Copy the SRV connection string into Render as `MONGODB_URI`.

The API starts without MongoDB in development, but production startup fails when `MONGODB_URI` or a sufficiently long `JWT_SECRET` is missing.

## Deploy backend to Render

Deployment is configured in [render.yaml](render.yaml).

1. Push this repository to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Connect the GitHub repository and select `render.yaml`.
4. Set the secret values marked `sync: false`, including `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, and Angel One credentials.
5. Deploy and verify `https://<your-render-domain>/health` returns JSON with `status: "ok"`.

Render uses:

```text
Root directory: backend
Build command: npm ci
Start command: npm start
Health check: /health
```

## Deploy frontend to Vercel

1. In Vercel, choose **Add New** -> **Project**.
2. Import the same GitHub repository.
3. Set **Root Directory** to `frontend`; [vercel.json](vercel.json) uses commands relative to that directory.
4. Add `VITE_API_URL` and `VITE_SOCKET_URL` using the deployed Render URL.
5. Deploy and verify the Vercel URL loads the dashboard shell.

Vercel automatically creates preview deployments for pull requests and production deployments for pushes to `main`.

## GitHub Actions

[CI workflow](.github/workflows/ci.yml) runs on pushes and pull requests targeting `main` and performs:

- Frontend dependency installation, lint, and production build
- Backend dependency installation and JavaScript syntax checks
- Local API startup and `/health` smoke test

No production secrets are required by CI. Configure deployment integrations in Vercel and Render through their GitHub connection settings.

## Build verification

```bash
npm run lint:frontend
npm run build:frontend
npm run check:backend
```

The OpenAPI document is available at [backend/openapi.yaml](backend/openapi.yaml).
# Stoclio

Market intelligence for Indian equities. The repository contains a Vite React frontend and an Express API designed for independent deployment.

## Repository

```text
stoclio/
├── frontend/   React + Vite UI
├── backend/    Express + MongoDB + JWT + Socket.IO API
├── render.yaml Render deployment blueprint
└── vercel.json Vercel frontend configuration
```

## Codespaces / local development

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm install --prefix frontend
npm install --prefix backend
npm run dev:backend
npm run dev:frontend
```

The frontend is available at `http://localhost:5173` and the API health check is at `http://localhost:5000/api/health`. When Angel One and MongoDB credentials are absent, the market endpoint returns clearly defined demo quotes so the UI remains usable during development.

## Environment

Set `MONGO_URI`, a long random `JWT_SECRET`, and `CLIENT_URL` in the backend. Angel One values are server-only and must never be placed in the frontend environment. `ANGEL_API_KEY`, `ANGEL_CLIENT_ID`, `ANGEL_PASSWORD`, and `ANGEL_TOTP` are reserved for the market-data provider integration.

## Scope boundary

Stoclio uses Angel One SmartAPI for market data only. There are intentionally no order-placement, broker-connection, holdings, positions, margin, or trading APIs in this service. User authentication and saved watchlists are application features; they do not connect a user to a broker account.

## Deployment

- **Vercel:** deploy from the repository with the frontend build configuration in `vercel.json`; set `VITE_API_URL` to the deployed Render API URL.
- **Render:** use `render.yaml` or create a Node web service with root directory `backend`, build command `npm ci`, start command `npm start`, and the backend environment variables above.

## Security notes

JWTs are signed server-side and passwords are hashed with bcrypt. Helmet, CORS, request-size limits, and structured route boundaries are enabled. Before production launch, configure a strict `CLIENT_URL`, use a managed secrets store, and run `npm audit` against the resolved dependency tree.
