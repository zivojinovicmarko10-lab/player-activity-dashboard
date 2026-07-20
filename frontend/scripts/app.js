const columns = [
  ["casinoBrand", "Casino/Brand", "text", 170],
  ["username", "Username", "text", 150],
  ["email", "Email Address", "email", 290],
  ["totalDepositsLifetime", "Total Deposits Lifetime", "money", 190],
  ["totalDeposits7d", "Total Deposits (Last 7 Days)", "money", 210],
  ["totalWithdrawalsLifetime", "Total Withdrawals Lifetime", "money", 210],
  ["totalWithdrawals7d", "Total Withdrawals (Last 7 Days)", "money", 225],
  ["lastDepositDate", "Last Deposit Date", "date", 175],
  ["lastLogin", "Last Login", "date", 175],
  ["depositActivityStatus", "Deposit Activity Status", "status", 210],
  ["netLifetime", "Net Lifetime", "money", 150],
  ["net7d", "Net Last 7 Days", "money", 165],
  ["playerClass", "Player Class", "text", 140]
];

const state = { page: 1, pageSize: 25, sortBy: "lastDepositDate", sortDir: "desc", search: "", filter: "all", brands: [], totalPages: 1, total: 0, refreshMs: 45000, timer: null };
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const els = {
  summaryCards: document.querySelector("#summaryCards"), tableHead: document.querySelector("#tableHead"), tableBody: document.querySelector("#tableBody"), tableStatus: document.querySelector("#tableStatus"), searchInput: document.querySelector("#searchInput"), activityFilter: document.querySelector("#activityFilter"), brandMenu: document.querySelector("#brandMenu"), brandMenuButton: document.querySelector("#brandMenuButton"), brandMenuLabel: document.querySelector("#brandMenuLabel"), brandMenuPanel: document.querySelector("#brandMenuPanel"), allBrandsCheckbox: document.querySelector("#allBrandsCheckbox"), brandOptions: document.querySelector("#brandOptions"), pageSize: document.querySelector("#pageSize"), refreshBtn: document.querySelector("#refreshBtn"), exportBtn: document.querySelector("#exportBtn"), excelBtn: document.querySelector("#excelBtn"), prevPage: document.querySelector("#prevPage"), nextPage: document.querySelector("#nextPage"), pageInfo: document.querySelector("#pageInfo"), shownCount: document.querySelector("#shownCount"), lastUpdated: document.querySelector("#lastUpdated")
};

function debounce(fn, wait = 220) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), wait); }; }
function apiUrl(path, params = {}) { const url = new URL(path, window.location.origin); Object.entries(params).forEach(([key, value]) => { if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, value); }); return url; }
async function fetchJson(path, params) { const response = await fetch(apiUrl(path, params), { headers: { accept: "application/json" } }); if (!response.ok) throw new Error(`Request failed (${response.status})`); return response.json(); }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : dateFmt.format(date); }
function formatCell(player, key, type) { if (type === "money") return money.format(Number(player[key] || 0)); if (type === "date") return formatDate(player[key]); if (type === "status") return player.depositActivityBadge || player[key]; return player[key] ?? ""; }
function setStatus(message) { els.tableStatus.textContent = message; }

function renderHead() {
  const row = document.createElement("tr");
  columns.forEach(([key, label, , width]) => {
    const th = document.createElement("th"); th.style.width = `${width}px`;
    const wrap = document.createElement("div"); wrap.className = "th-content";
    const button = document.createElement("button"); button.type = "button"; button.className = "sort-button"; if (state.sortBy === key) button.classList.add("is-active"); button.textContent = label; button.title = `Sort by ${label}`;
    button.addEventListener("click", () => { if (state.sortBy === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; else { state.sortBy = key; state.sortDir = "asc"; } state.page = 1; loadPlayers(); });
    const handle = document.createElement("span"); handle.className = "resize-handle"; handle.addEventListener("mousedown", (event) => startResize(event, th));
    wrap.append(button, handle); th.append(wrap); row.append(th);
  });
  els.tableHead.replaceChildren(row);
}

function startResize(event, th) { event.preventDefault(); const startX = event.clientX; const startWidth = th.offsetWidth; const move = (moveEvent) => { th.style.width = `${Math.max(96, startWidth + moveEvent.clientX - startX)}px`; }; const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }
function renderRows(players) { if (!players.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = columns.length; td.className = "empty"; td.textContent = "No players match the current search and filter."; tr.append(td); els.tableBody.replaceChildren(tr); return; } const rows = players.map((player) => { const tr = document.createElement("tr"); tr.className = `tone-${player.rowTone}`; columns.forEach(([key, , type]) => { const td = document.createElement("td"); if (type === "status") { const badge = document.createElement("span"); badge.className = `badge badge-${player.depositActivityCode}`; badge.textContent = formatCell(player, key, type); td.append(badge); } else { td.textContent = formatCell(player, key, type); if (type === "email") { td.className = "email-cell"; td.title = td.textContent; } if (type === "money" && String(key).startsWith("net")) td.className = Number(player[key] || 0) >= 0 ? "money-positive" : "money-negative"; } tr.append(td); }); return tr; }); els.tableBody.replaceChildren(...rows); }
function renderSummary(summary) { const cards = [["Total Players", summary.totalPlayers, "number"], ["Deposited Today", summary.depositedToday, "number"], ["Deposited Last 3 Days", summary.depositedLast3Days, "number"], ["At Risk Players (7+ Days)", summary.atRiskPlayers, "number"], ["Total Deposits Today", summary.totalDepositsToday, "money"], ["Total Deposits Last 7 Days", summary.totalDepositsLast7Days, "money"], ["Total Withdrawals Today", summary.totalWithdrawalsToday, "money"], ["Total Withdrawals Last 7 Days", summary.totalWithdrawalsLast7Days, "money"]].map(([label, value, type]) => { const card = document.createElement("article"); card.className = "summary-card"; const span = document.createElement("span"); span.textContent = label; const strong = document.createElement("strong"); strong.textContent = type === "money" ? money.format(value || 0) : new Intl.NumberFormat().format(value || 0); card.append(span, strong); return card; }); els.summaryCards.replaceChildren(...cards); }
function updateMeta(meta, shown) { state.page = meta.page; state.totalPages = meta.totalPages; state.total = meta.total; els.pageInfo.textContent = `Page ${meta.page} of ${meta.totalPages}`; els.shownCount.textContent = `${new Intl.NumberFormat().format(shown)} players shown of ${new Intl.NumberFormat().format(meta.total)}`; els.prevPage.disabled = meta.page <= 1; els.nextPage.disabled = meta.page >= meta.totalPages; els.lastUpdated.textContent = `Last Updated: ${dateFmt.format(new Date(meta.lastUpdated))}`; }
async function loadSummary() { const result = await fetchJson("/api/vip/summary", { brands: state.brands.join(",") }); renderSummary(result.data); }
function updateBrandMenuLabel() { if (!state.brands.length) els.brandMenuLabel.textContent = "All Brands"; else if (state.brands.length === 1) els.brandMenuLabel.textContent = state.brands[0]; else els.brandMenuLabel.textContent = `${state.brands.length} Brands`; els.allBrandsCheckbox.checked = state.brands.length === 0; }
function applyBrandFilter() { state.page = 1; updateBrandMenuLabel(); refreshAll(); }
async function loadBrands() { const result = await fetchJson("/api/vip/brands"); const options = result.data.map((brand) => { const label = document.createElement("label"); label.className = "check-row"; const input = document.createElement("input"); input.type = "checkbox"; input.value = brand.value; input.addEventListener("change", () => { state.brands = Array.from(els.brandOptions.querySelectorAll("input:checked")).map((item) => item.value); applyBrandFilter(); }); const text = document.createElement("span"); text.textContent = brand.label; label.append(input, text); return label; }); els.brandOptions.replaceChildren(...options); updateBrandMenuLabel(); }
async function loadPlayers() { setStatus("Loading players..."); try { renderHead(); const result = await fetchJson("/api/vip/players", { page: state.page, pageSize: state.pageSize, sortBy: state.sortBy, sortDir: state.sortDir, search: state.search, filter: state.filter, brands: state.brands.join(",") }); renderRows(result.data); updateMeta(result.meta, result.data.length); setStatus(""); } catch (error) { setStatus(error.message || "Unable to load players."); } }
async function refreshAll() { els.refreshBtn.disabled = true; try { await Promise.all([loadSummary(), loadPlayers()]); } finally { els.refreshBtn.disabled = false; } }
function exportPlayers(format = "csv") { window.location.href = apiUrl("/api/vip/players/export", { sortBy: state.sortBy, sortDir: state.sortDir, search: state.search, filter: state.filter, brands: state.brands.join(","), format }).toString(); }

els.searchInput.addEventListener("input", debounce((event) => { state.search = event.target.value; state.page = 1; loadPlayers(); }));
els.activityFilter.addEventListener("change", (event) => { state.filter = event.target.value; state.page = 1; loadPlayers(); });
els.brandMenuButton.addEventListener("click", () => { const nextOpen = els.brandMenuPanel.hidden; els.brandMenuPanel.hidden = !nextOpen; els.brandMenuButton.setAttribute("aria-expanded", String(nextOpen)); });
els.allBrandsCheckbox.addEventListener("change", () => { state.brands = []; els.brandOptions.querySelectorAll("input").forEach((input) => { input.checked = false; }); els.allBrandsCheckbox.checked = true; applyBrandFilter(); });
document.addEventListener("click", (event) => { if (!els.brandMenu.contains(event.target)) { els.brandMenuPanel.hidden = true; els.brandMenuButton.setAttribute("aria-expanded", "false"); } });
els.pageSize.addEventListener("change", (event) => { state.pageSize = Number(event.target.value); state.page = 1; loadPlayers(); });
els.prevPage.addEventListener("click", () => { state.page = Math.max(1, state.page - 1); loadPlayers(); });
els.nextPage.addEventListener("click", () => { state.page = Math.min(state.totalPages, state.page + 1); loadPlayers(); });
els.refreshBtn.addEventListener("click", refreshAll);
els.exportBtn.addEventListener("click", () => exportPlayers("csv"));
els.excelBtn.addEventListener("click", () => exportPlayers("xls"));
loadBrands().catch((error) => setStatus(error.message || "Unable to load brands."));
refreshAll();
state.timer = window.setInterval(refreshAll, state.refreshMs);
