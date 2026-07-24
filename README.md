# Player Activity Dashboard

Modern dark-theme casino backoffice dashboard for internal VIP managers.

## Run

```bash
npm start
```

Open `http://localhost:4173`.

For production, set:

```bash
VIP_DASHBOARD_TOKEN=replace-with-a-long-random-token
ALLOWED_ORIGINS=https://backoffice.example.com
PORT=4173
CASINO_API_BASE_URL=https://api.example.com
CASINO_API_TOKEN=replace-with-your-api-token
```

When `VIP_DASHBOARD_TOKEN` is set, API calls require:

```http
Authorization: Bearer replace-with-a-long-random-token
```

## API

### `GET /api/vip/players`

Query parameters:

- `page`: page number, default `1`
- `pageSize`: `10` to `100`, default `25`
- `sortBy`: any table column key
- `sortDir`: `asc` or `desc`
- `search`: username or email substring
- `filter`: `all`, `today`, `last3`, `last7`, `risk7`
- `brands`: optional comma-separated casino/brand names from `GET /api/vip/brands`

Example:

```http
GET /api/vip/players?page=1&pageSize=25&sortBy=netLifetime&sortDir=desc&filter=last7
```

### `GET /api/vip/summary`

Returns summary cards:

- Total Players
- Deposited Today
- Deposited Last 3 Days
- At Risk Players
- Total Deposits Today
- Total Deposits Last 7 Days
- Total Withdrawals Today
- Total Withdrawals Last 7 Days

Accepts optional `brands` to scope the summary to one or more casinos/brands.

### `GET /api/vip/brands`

Returns available casino/brand values for the dashboard dropdown.

### `GET /api/vip/player/{id}`

Returns one enriched player row by ID.

### `GET /api/vip/players/export`

Exports the current filtered/sorted player set.

- `format=csv`: CSV file
- `format=xls`: Excel-compatible HTML workbook

## Swagger / API Integration

The demo uses `backend/mockPlayerRepository.js` unless `CASINO_API_BASE_URL` is set. In Vercel, add the upstream Swagger/API details as environment variables:

```txt
CASINO_API_BASE_URL=https://api.example.com
CASINO_API_TOKEN=secret-token-from-your-api-provider
CASINO_API_AUTH_HEADER=Authorization
CASINO_API_AUTH_SCHEME=Bearer
CASINO_API_PLAYERS_PATH=/players
CASINO_API_BRANDS_PATH=/brands
CASINO_API_PLAYER_PATH=/players/{id}
CASINO_API_SUMMARY_PATH=/vip/summary
```

Only `CASINO_API_BASE_URL` is required to switch from mock data to live API mode. If the API does not have a summary endpoint, leave `CASINO_API_SUMMARY_PATH` empty and the dashboard will compute summary totals from player pages.

For multi-brand API mode, set:

```txt
CASINO_API_MODE=multi
CASINO_API_BRANDS_CONFIG=[{"brand":"MrO Casino","prefix":"MRO"}]
MRO_API_BASE_URL=https://mccmrocasweb.mrocasino.com/MROENQFOCPHSLLUSVPHD/RTGWebAPI
MRO_API_PLAYERS_PATH=/Player
MRO_API_PLAYER_PATH=/Player/Player_GetPlayer
MRO_API_TOKEN=secret-token
```

Each additional brand can be added by extending `CASINO_API_BRANDS_CONFIG` and adding matching `{PREFIX}_API_*` variables.

`backend/apiPlayerRepository.js` normalizes common Swagger response field names into the dashboard shape:

```js
{
  id,
  casinoBrand,
  username,
  email,
  totalDepositsLifetime,
  totalDeposits7d,
  depositsToday,
  totalWithdrawalsLifetime,
  totalWithdrawals7d,
  withdrawalsToday,
  lastDepositDate,
  lastLogin,
  playerClass
}
```

If your Swagger uses different field names, update `normalizePlayer()` in `backend/apiPlayerRepository.js`.

## Database Integration

For direct database production use, replace the repository with an implementation that pushes pagination, search, filtering, sorting, and summary aggregation into SQL. Keep the API response shape the same so the frontend does not need to change.

Recommended SQL patterns:

- Use parameterized queries only.
- Allowlist sort columns instead of interpolating arbitrary user input.
- Add indexes on `username`, `email`, `last_deposit_at`, `last_login_at`, and any tenant/brand fields.
- Use `LIMIT` / `OFFSET` or cursor pagination for `GET /api/vip/players`.
- Compute summary totals with aggregate SQL queries.
- Use row-level authorization or tenant predicates for brand-restricted VIP managers.

Example repository contract:

```js
class SqlPlayerRepository {
  async listPlayers({ page, pageSize, sortBy, sortDir, search, filter }) {}
  async listPlayersForExport(query) {}
  async getSummary() {}
  async getPlayerById(id) {}
}
```

## Security Notes

- The frontend renders API values with `textContent`, not `innerHTML`.
- The server sets CSP, frame, referrer, and MIME-sniffing headers.
- The backend validates pagination limits and sort columns.
- Production deployments should terminate TLS at a reverse proxy, set `VIP_DASHBOARD_TOKEN`, and connect to your identity provider for role-based access control.
