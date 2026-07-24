import http from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { columns } from "./business.js";
import { createPlayerRepository } from "./repositoryFactory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const repository = createPlayerRepository();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, securityHeaders({ "content-type": "application/json; charset=utf-8" }));
  res.end(payload);
}

function securityHeaders(extra = {}) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy":
      "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...extra
  };
}

function isAuthorized(req) {
  if (!config.authToken) return true;
  const header = req.headers.authorization || "";
  return header === `Bearer ${config.authToken}`;
}

function parseQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  return { url, query: Object.fromEntries(url.searchParams.entries()) };
}

function toCsv(rows) {
  const headers = columns.map((column) => column.label);
  const keys = columns.map((column) => column.key);
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    headers.map(escapeCell).join(","),
    ...rows.map((row) =>
      keys.map((key) => escapeCell(key === "depositActivityStatus" ? row.depositActivityBadge : row[key])).join(",")
    )
  ].join("\n");
}

function toExcelHtml(rows) {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const headerCells = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = column.key === "depositActivityStatus" ? row.depositActivityBadge : row[column.key];
          return `<td>${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
}

async function serveApi(req, res, pathname, query) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return true;
  }

  try {
    if (req.method === "GET" && pathname === "/api/vip/players") {
      sendJson(res, 200, await repository.listPlayers(query));
      return true;
    }

    if (req.method === "GET" && pathname === "/api/vip/brands") {
      sendJson(res, 200, await repository.listBrands());
      return true;
    }

    if (req.method === "GET" && pathname === "/api/vip/players/export") {
      const exportResult = await repository.listPlayersForExport(query);
      const format = query.format === "xls" ? "xls" : "csv";
      if (format === "xls") {
        const excelHtml = toExcelHtml(exportResult.data);
        res.writeHead(
          200,
          securityHeaders({
            "content-type": "application/vnd.ms-excel; charset=utf-8",
            "content-disposition": `attachment; filename="vip-players-${new Date().toISOString().slice(0, 10)}.xls"`,
            "x-exported-rows": String(exportResult.exportedRows),
            "x-total-rows": String(exportResult.totalRows)
          })
        );
        res.end(excelHtml);
        return true;
      }
      const csv = toCsv(exportResult.data);
      res.writeHead(
        200,
        securityHeaders({
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="vip-players-${new Date().toISOString().slice(0, 10)}.csv"`,
          "x-exported-rows": String(exportResult.exportedRows),
          "x-total-rows": String(exportResult.totalRows)
        })
      );
      res.end(csv);
      return true;
    }

    if (req.method === "GET" && pathname === "/api/vip/summary") {
      sendJson(res, 200, await repository.getSummary(query));
      return true;
    }

    const playerMatch = pathname.match(/^\/api\/vip\/player\/([^/]+)$/);
    if (req.method === "GET" && playerMatch) {
      const player = await repository.getPlayerById(decodeURIComponent(playerMatch[1]));
      if (!player) sendJson(res, 404, { error: "Player not found" });
      else sendJson(res, 200, { data: player, meta: { lastUpdated: new Date().toISOString() } });
      return true;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Endpoint not found" });
      return true;
    }
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
    return true;
  }

  return false;
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(frontendDir, safePath));
  if (!filePath.startsWith(frontendDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const stat = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, securityHeaders({ "content-type": contentTypes[ext] || "application/octet-stream" }));
    res.end(stat);
  } catch {
    const indexStream = createReadStream(path.join(frontendDir, "index.html"));
    res.writeHead(200, securityHeaders({ "content-type": contentTypes[".html"] }));
    indexStream.pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  const { url, query } = parseQuery(req);
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.length && !config.allowedOrigins.includes(origin)) {
    sendJson(res, 403, { error: "Origin not allowed" });
    return;
  }
  const handled = await serveApi(req, res, url.pathname, query);
  if (!handled) await serveStatic(req, res, url.pathname);
});

server.listen(config.port, () => {
  console.log(`VIP dashboard running at http://localhost:${config.port}`);
  console.log(`Refresh interval: ${config.refreshSeconds}s`);
  if (!config.authToken) console.log("Auth token is disabled for local demo. Set VIP_DASHBOARD_TOKEN in production.");
});
