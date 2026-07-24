import { enrichPlayer, getSummary, matchesActivityFilter, sortableKeys } from "./business.js";

const DEFAULT_BRANDS = [
  "MrO Casino",
  "Eternal Slots",
  "Goat Spins",
  "Detective Slots",
  "Sloto Tribe",
  "Asgard Slots",
  "Jurassic Slots",
  "Orca Spins",
  "Fortunate Buddha",
  "Ronin Slots",
  "Jackoro"
];

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined));
}

function pick(source, keys, fallback = "") {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null) return source[key];
  }
  return fallback;
}

function numberFrom(source, keys) {
  const value = pick(source, keys, 0);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseRows(payload) {
  if (Array.isArray(payload)) return { rows: payload, total: payload.length, totalPages: 1 };
  const rows = payload.data || payload.items || payload.players || payload.results || payload.records || [];
  const meta = payload.meta || payload.pagination || {};
  return {
    rows: Array.isArray(rows) ? rows : [],
    total: Number(payload.total ?? payload.totalCount ?? meta.total ?? meta.totalCount ?? rows.length ?? 0),
    totalPages: Number(payload.totalPages ?? meta.totalPages ?? meta.pages ?? 1)
  };
}

function joinPath(baseUrl, path) {
  const cleanBase = String(baseUrl || "").replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

function replacePathParams(path, params) {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, encodeURIComponent(value)),
    path
  );
}

function normalizeBrand(brand) {
  if (typeof brand === "string") return { value: brand, label: brand };
  const value = pick(brand, ["value", "name", "brandName", "casinoBrand", "casino", "brand", "id"], "");
  const label = pick(brand, ["label", "name", "brandName", "casinoBrand", "casino", "brand"], value);
  return value ? { value: String(value), label: String(label) } : null;
}

export function normalizePlayer(apiPlayer) {
  const totalDepositsLifetime = numberFrom(apiPlayer, [
    "totalDepositsLifetime",
    "depositTotal",
    "totalDeposits",
    "lifetimeDeposits",
    "depositsLifetime"
  ]);
  const totalDeposits7d = numberFrom(apiPlayer, ["totalDeposits7d", "depositsLast7Days", "depositLast7Days", "deposits7d"]);
  const totalWithdrawalsLifetime = numberFrom(apiPlayer, [
    "totalWithdrawalsLifetime",
    "withdrawalTotal",
    "totalWithdrawals",
    "lifetimeWithdrawals",
    "withdrawalsLifetime"
  ]);
  const totalWithdrawals7d = numberFrom(apiPlayer, [
    "totalWithdrawals7d",
    "withdrawalsLast7Days",
    "withdrawalLast7Days",
    "withdrawals7d"
  ]);

  return {
    id: String(pick(apiPlayer, ["id", "playerId", "userId", "customerId"], "")),
    casinoBrand: String(pick(apiPlayer, ["casinoBrand", "brandName", "casino", "brand", "siteName"], "")),
    username: String(pick(apiPlayer, ["username", "userName", "login", "screenName"], "")),
    email: String(pick(apiPlayer, ["email", "emailAddress", "mail"], "")),
    totalDepositsLifetime,
    totalDeposits7d,
    depositsToday: numberFrom(apiPlayer, ["depositsToday", "depositToday", "totalDepositsToday"]),
    totalWithdrawalsLifetime,
    totalWithdrawals7d,
    withdrawalsToday: numberFrom(apiPlayer, ["withdrawalsToday", "withdrawalToday", "totalWithdrawalsToday"]),
    lastDepositDate: pick(apiPlayer, ["lastDepositDate", "lastDepositAt", "lastDeposit", "last_deposit_at"], null),
    lastLogin: pick(apiPlayer, ["lastLogin", "lastLoginAt", "lastSeenAt", "last_login_at"], null),
    playerClass: String(pick(apiPlayer, ["playerClass", "vipClass", "class", "segment", "tier"], ""))
  };
}

export class ApiPlayerRepository {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.CASINO_API_BASE_URL || "";
    this.token = options.token || process.env.CASINO_API_TOKEN || "";
    this.authHeader = options.authHeader || process.env.CASINO_API_AUTH_HEADER || "Authorization";
    this.authScheme = options.authScheme ?? process.env.CASINO_API_AUTH_SCHEME ?? "Bearer";
    this.playersPath = options.playersPath || process.env.CASINO_API_PLAYERS_PATH || "/players";
    this.brandsPath = options.brandsPath || process.env.CASINO_API_BRANDS_PATH || "/brands";
    this.playerPath = options.playerPath || process.env.CASINO_API_PLAYER_PATH || "/players/{id}";
    this.summaryPath = options.summaryPath || process.env.CASINO_API_SUMMARY_PATH || "";
    this.brandName = options.brandName || "";
    this.idPrefix = options.idPrefix || "";
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  headers() {
    const headers = { accept: "application/json" };
    if (this.token) headers[this.authHeader] = this.authScheme ? `${this.authScheme} ${this.token}` : this.token;
    return headers;
  }

  async getJson(path, query = {}) {
    if (!this.baseUrl) throw new Error("CASINO_API_BASE_URL is not configured.");
    const url = new URL(joinPath(this.baseUrl, path));
    Object.entries(compactObject(query)).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (!response.ok) throw new Error(`Casino API request failed (${response.status})`);
    return response.json();
  }

  upstreamQuery(query) {
    return compactObject({
      page: query.page,
      pageSize: query.pageSize,
      limit: query.pageSize,
      search: query.search,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      filter: query.filter,
      brands: query.brands
    });
  }

  async listBrands() {
    try {
      const payload = await this.getJson(this.brandsPath);
      const rows = Array.isArray(payload) ? payload : payload.data || payload.items || payload.brands || [];
      const data = rows.map(normalizeBrand).filter(Boolean);
      return { data: data.length ? data : DEFAULT_BRANDS.map((brand) => ({ value: brand, label: brand })), meta: { lastUpdated: new Date().toISOString() } };
    } catch {
      return {
        data: DEFAULT_BRANDS.map((brand) => ({ value: brand, label: brand })),
        meta: { lastUpdated: new Date().toISOString() }
      };
    }
  }

  async listPlayers(query) {
    const now = new Date();
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 25)));
    const payload = await this.getJson(this.playersPath, this.upstreamQuery({ ...query, page, pageSize }));
    const parsed = parseRows(payload);
    const search = String(query.search || "").trim().toLowerCase();
    const selectedBrands = String(query.brands || "")
      .split(",")
      .map((brand) => brand.trim())
      .filter(Boolean);

    const enrichedRows = parsed.rows
      .map(normalizePlayer)
      .map((player) => ({
        ...player,
        id: this.idPrefix && player.id ? `${this.idPrefix}:${player.id}` : player.id,
        upstreamId: player.id,
        casinoBrand: player.casinoBrand || this.brandName
      }))
      .filter((player) => player.lastDepositDate)
      .map((player) => enrichPlayer(player, now))
      .filter((player) => {
        const matchesSearch =
          !search ||
          player.username.toLowerCase().includes(search) ||
          player.email.toLowerCase().includes(search);
        const matchesBrand = !selectedBrands.length || selectedBrands.includes(player.casinoBrand);
        return matchesSearch && matchesBrand && matchesActivityFilter(player, query.filter || "all", now);
      });

    const sortBy = sortableKeys.has(query.sortBy) ? query.sortBy : "lastDepositDate";
    const sortDir = query.sortDir === "asc" ? "asc" : "desc";
    return {
      data: enrichedRows,
      meta: {
        page,
        pageSize,
        total: parsed.total || enrichedRows.length,
        totalPages: parsed.totalPages || Math.max(1, Math.ceil(enrichedRows.length / pageSize)),
        sortBy,
        sortDir,
        lastUpdated: now.toISOString()
      }
    };
  }

  async listPlayersForExport(query) {
    const rows = [];
    let page = 1;
    let totalRows = 0;
    let totalPages = 1;
    do {
      const chunk = await this.listPlayers({ ...query, page, pageSize: 100 });
      rows.push(...chunk.data);
      totalRows = chunk.meta.total;
      totalPages = chunk.meta.totalPages;
      page += 1;
    } while (page <= totalPages && rows.length < 50000);
    return { data: rows, exportedRows: rows.length, totalRows };
  }

  async getSummary(query = {}) {
    if (this.summaryPath) {
      const payload = await this.getJson(this.summaryPath, compactObject({ brands: query.brands }));
      return { data: payload.data || payload.summary || payload, meta: { lastUpdated: new Date().toISOString() } };
    }
    const exportRows = await this.listPlayersForExport(query);
    return {
      data: getSummary(exportRows.data, new Date()),
      meta: { lastUpdated: new Date().toISOString() }
    };
  }

  async getPlayerById(id) {
    const upstreamId = this.idPrefix && String(id).startsWith(`${this.idPrefix}:`)
      ? String(id).slice(this.idPrefix.length + 1)
      : id;
    const payload = await this.getJson(replacePathParams(this.playerPath, { id: upstreamId }));
    const player = normalizePlayer(payload.data || payload.player || payload);
    return enrichPlayer({
      ...player,
      id: this.idPrefix && player.id ? `${this.idPrefix}:${player.id}` : player.id,
      upstreamId: player.id,
      casinoBrand: player.casinoBrand || this.brandName
    }, new Date());
  }
}
