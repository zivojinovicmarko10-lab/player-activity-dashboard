import { columns } from "../../../../../backend/business.js";
import { queryFromRequest, repository } from "../../repository.js";

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

export async function GET(request) {
  const query = queryFromRequest(request);
  const exportResult = await repository.listPlayersForExport(query);
  const format = query.format === "xls" ? "xls" : "csv";
  const body = format === "xls" ? toExcelHtml(exportResult.data) : toCsv(exportResult.data);
  const contentType = format === "xls" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8";
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="player-activity-${new Date().toISOString().slice(0, 10)}.${format}"`,
      "x-content-type-options": "nosniff",
      "x-exported-rows": String(exportResult.exportedRows),
      "x-total-rows": String(exportResult.totalRows)
    }
  });
}
