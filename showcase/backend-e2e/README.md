# Express + PostgreSQL example

Small Express API backed by PostgreSQL. Docker Compose starts PostgreSQL and
loads [`init.sql`](./init.sql), which creates and seeds the `payments` table.

## Run

```bash
docker compose up -d
npm test
```

Start the API directly:

```bash
DATABASE_URL=postgresql://test:test@127.0.0.1:5432/backend_e2e \
  node --experimental-strip-types src/app.ts
```

## Routes

- `GET /health` returns `{ "status": "ok" }`.
- `GET /payments` lists payments from PostgreSQL.
- `POST /payments` creates a payment. Amount uses minor currency units.
- `POST /orders` demonstrates an order calling the node-test-kit payment stub.

Example payment request:

```bash
curl -X POST http://127.0.0.1:4000/payments \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1004","amount":1999,"currency":"USD"}'
```

`DATABASE_URL` is optional. Without it, the app uses the local Compose
connection shown above.
