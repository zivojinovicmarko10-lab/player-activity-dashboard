import { enrichPlayer, matchesActivityFilter, sortableKeys } from "./business.js";

const brands = [
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
const classes = ["Diamond", "Platinum", "Gold", "Silver", "Bronze"];
const names = [
  "alex", "mira", "dante", "sofia", "niko", "lara", "roman", "ines", "milan", "eva",
  "kai", "tessa", "leo", "aria", "max", "noa", "viktor", "lena", "omar", "zara"
];

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(10 + (days % 11), 15, 0, 0);
  return date.toISOString();
}

function createPlayers(count = 2500) {
  return Array.from({ length: count }, (_, index) => {
    const id = String(index + 1);
    const baseName = names[index % names.length];
    const username = `${baseName}${String(index + 101).padStart(4, "0")}`;
    const hasDeposit = index % 17 !== 0;
    const depositAge = hasDeposit ? [0, 1, 2, 3, 4, 6, 8, 11, 18, 31][index % 10] : null;
    const totalDepositsLifetime = Math.round(600 + ((index * 137) % 120000));
    const totalWithdrawalsLifetime = Math.round(totalDepositsLifetime * (0.18 + ((index % 47) / 100)));
    const totalDeposits7d = hasDeposit && depositAge <= 7 ? Math.round(100 + ((index * 53) % 9000)) : 0;
    const totalWithdrawals7d = Math.round(totalDeposits7d * ((index % 35) / 100));
    const withdrawalsToday = depositAge === 0 ? Math.round(totalWithdrawals7d * 0.45) : 0;

    return {
      id,
      casinoBrand: brands[index % brands.length],
      username,
      email: `${username}@example-casino.test`,
      totalDepositsLifetime: hasDeposit ? totalDepositsLifetime : 0,
      totalDeposits7d,
      depositsToday: depositAge === 0 ? Math.max(50, Math.round(totalDeposits7d * 0.45)) : 0,
      totalWithdrawalsLifetime: hasDeposit ? totalWithdrawalsLifetime : 0,
      totalWithdrawals7d,
      withdrawalsToday,
      lastDepositDate: hasDeposit ? daysAgo(depositAge) : null,
      lastLogin: daysAgo((index * 3) % 45),
      playerClass: classes[index % classes.length]
    };
  });
}

const players = createPlayers(Number(process.env.MOCK_PLAYER_COUNT || 2500));
const depositingPlayers = players.filter((player) => player.lastDepositDate);

function parseBrandFilter(query) {
  const rawBrands = String(query.brands || query.brand || "")
    .split(",")
    .map((brand) => brand.trim())
    .filter(Boolean);
  const allowedBrands = new Set(brands);
  return rawBrands.filter((brand) => allowedBrands.has(brand));
}

function sortPlayers(rows, sortBy, sortDir) {
  const key = sortableKeys.has(sortBy) ? sortBy : "lastDepositDate";
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
}

export class MockPlayerRepository {
  async listBrands() {
    return {
      data: brands.map((brand) => ({ value: brand, label: brand })),
      meta: { lastUpdated: new Date().toISOString() }
    };
  }

  async listPlayers(query) {
    const now = new Date();
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 25)));
    const search = String(query.search || "").trim().toLowerCase();
    const filter = String(query.filter || "all");
    const selectedBrands = parseBrandFilter(query);

    const filtered = depositingPlayers
      .map((player) => enrichPlayer(player, now))
      .filter((player) => {
        const matchesSearch =
          !search ||
          player.username.toLowerCase().includes(search) ||
          player.email.toLowerCase().includes(search);
        const matchesBrand = !selectedBrands.length || selectedBrands.includes(player.casinoBrand);
        return matchesSearch && matchesBrand && matchesActivityFilter(player, filter, now);
      });

    const sorted = sortPlayers(filtered, query.sortBy, query.sortDir);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      data: sorted.slice(start, start + pageSize),
      meta: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        sortBy: sortableKeys.has(query.sortBy) ? query.sortBy : "lastDepositDate",
        sortDir: query.sortDir === "asc" ? "asc" : "desc",
        lastUpdated: now.toISOString()
      }
    };
  }

  async listPlayersForExport(query) {
    const result = await this.listPlayers({ ...query, page: 1, pageSize: 100 });
    const rows = [];
    let page = 1;
    let totalPages = 1;
    do {
      const chunk = await this.listPlayers({ ...query, page, pageSize: 100 });
      rows.push(...chunk.data);
      totalPages = chunk.meta.totalPages;
      page += 1;
    } while (page <= totalPages && rows.length < 50000);
    return { data: rows, exportedRows: rows.length, totalRows: result.meta.total };
  }

  async getSummary(query = {}) {
    const { getSummary } = await import("./business.js");
    const now = new Date();
    const selectedBrands = parseBrandFilter(query);
    const scopedPlayers = selectedBrands.length
      ? depositingPlayers.filter((player) => selectedBrands.includes(player.casinoBrand))
      : depositingPlayers;
    return {
      data: getSummary(scopedPlayers, now),
      meta: { lastUpdated: now.toISOString() }
    };
  }

  async getPlayerById(id) {
    const player = depositingPlayers.find((item) => item.id === String(id));
    return player ? enrichPlayer(player, new Date()) : null;
  }
}
