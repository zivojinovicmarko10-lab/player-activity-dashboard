import { ApiPlayerRepository } from "./apiPlayerRepository.js";
import { getSummary, sortableKeys } from "./business.js";
import { MockPlayerRepository } from "./mockPlayerRepository.js";

function parseBrandsConfig() {
  if (!process.env.CASINO_API_BRANDS_CONFIG) return [];
  try {
    const parsed = JSON.parse(process.env.CASINO_API_BRANDS_CONFIG);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function envValue(prefix, key, fallback = "") {
  return process.env[`${prefix}_API_${key}`] || process.env[`CASINO_API_${key}`] || fallback;
}

function sortRows(rows, sortBy, sortDir) {
  const key = sortableKeys.has(sortBy) ? sortBy : "lastDepositDate";
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
}

export class MultiBrandApiPlayerRepository {
  constructor(configs = parseBrandsConfig()) {
    this.configs = configs
      .map((config) => ({
        brand: config.brand || config.label || "",
        prefix: config.prefix || ""
      }))
      .filter((config) => config.brand && config.prefix);
    this.repositories = this.configs
      .map((config) => ({
        ...config,
        repository: new ApiPlayerRepository({
          baseUrl: envValue(config.prefix, "BASE_URL"),
          token: envValue(config.prefix, "TOKEN"),
          authHeader: envValue(config.prefix, "AUTH_HEADER", "Authorization"),
          authScheme: envValue(config.prefix, "AUTH_SCHEME", "Bearer"),
          playersPath: envValue(config.prefix, "PLAYERS_PATH", "/players"),
          brandsPath: envValue(config.prefix, "BRANDS_PATH", "/brands"),
          playerPath: envValue(config.prefix, "PLAYER_PATH", "/players/{id}"),
          summaryPath: envValue(config.prefix, "SUMMARY_PATH"),
          brandName: config.brand,
          idPrefix: config.prefix
        })
      }))
      .filter((entry) => entry.repository.isConfigured());
  }

  isConfigured() {
    return this.repositories.length > 0;
  }

  async listBrands() {
    return {
      data: this.repositories.map((entry) => ({ value: entry.brand, label: entry.brand })),
      meta: { lastUpdated: new Date().toISOString() }
    };
  }

  selectedRepositories(query = {}) {
    const selectedBrands = String(query.brands || "")
      .split(",")
      .map((brand) => brand.trim())
      .filter(Boolean);
    if (!selectedBrands.length) return this.repositories;
    return this.repositories.filter((entry) => selectedBrands.includes(entry.brand));
  }

  async listPlayers(query = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 25)));
    const rows = (
      await Promise.all(
        this.selectedRepositories(query).map((entry) =>
          entry.repository.listPlayers({ ...query, brands: "", page: 1, pageSize: 100 })
        )
      )
    ).flatMap((result) => result.data);
    const sorted = sortRows(rows, query.sortBy, query.sortDir);
    const start = (page - 1) * pageSize;
    const total = sorted.length;
    return {
      data: sorted.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        sortBy: sortableKeys.has(query.sortBy) ? query.sortBy : "lastDepositDate",
        sortDir: query.sortDir === "asc" ? "asc" : "desc",
        lastUpdated: new Date().toISOString()
      }
    };
  }

  async listPlayersForExport(query = {}) {
    const result = await this.listPlayers({ ...query, page: 1, pageSize: 100 });
    const rows = [...result.data];
    let page = 2;
    while (page <= result.meta.totalPages && rows.length < 50000) {
      const chunk = await this.listPlayers({ ...query, page, pageSize: 100 });
      rows.push(...chunk.data);
      page += 1;
    }
    return { data: rows, exportedRows: rows.length, totalRows: result.meta.total };
  }

  async getSummary(query = {}) {
    const exportRows = await this.listPlayersForExport(query);
    return {
      data: getSummary(exportRows.data, new Date()),
      meta: { lastUpdated: new Date().toISOString() }
    };
  }

  async getPlayerById(id) {
    const prefix = String(id).split(":")[0];
    const entry = this.repositories.find((item) => item.prefix === prefix) || this.repositories[0];
    return entry ? entry.repository.getPlayerById(id) : null;
  }
}

export function createPlayerRepository() {
  if (process.env.CASINO_API_MODE === "multi") {
    const multiRepository = new MultiBrandApiPlayerRepository();
    if (multiRepository.isConfigured()) return multiRepository;
  }
  const apiRepository = new ApiPlayerRepository();
  return apiRepository.isConfigured() ? apiRepository : new MockPlayerRepository();
}
