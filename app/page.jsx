export default function Page() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Casino Backoffice</p>
          <h1>Player Activity</h1>
        </div>
        <div className="topbar-actions">
          <span id="lastUpdated" className="timestamp">Last Updated: --</span>
          <button id="refreshBtn" className="icon-button" type="button" title="Refresh data" aria-label="Refresh data">
            <span className="refresh-glyph" aria-hidden="true"></span>
          </button>
          <button id="exportBtn" className="button" type="button">Export CSV</button>
          <button id="excelBtn" className="button" type="button">Export Excel</button>
        </div>
      </header>

      <section id="summaryCards" className="summary-grid" aria-label="Player activity summary"></section>

      <section className="table-panel">
        <div className="controls">
          <label className="search-field">
            <span>Search</span>
            <input id="searchInput" type="search" placeholder="Username or email" autoComplete="off" />
          </label>
          <label className="select-field">
            <span>Filter</span>
            <select id="activityFilter" defaultValue="all">
              <option value="all">All Players</option>
              <option value="today">Deposited Today</option>
              <option value="last3">Deposited Last 3 Days</option>
              <option value="last7">Deposited Last 7 Days</option>
              <option value="risk7">No Deposit 7+ Days</option>
            </select>
          </label>
          <div className="multi-field" id="brandMenu">
            <span>Casino/Brand</span>
            <button id="brandMenuButton" className="multi-button" type="button" aria-expanded="false" aria-haspopup="true">
              <span id="brandMenuLabel">All Brands</span>
              <span className="chevron" aria-hidden="true">v</span>
            </button>
            <div id="brandMenuPanel" className="multi-panel" role="menu" hidden>
              <label className="check-row">
                <input id="allBrandsCheckbox" type="checkbox" defaultChecked />
                <span>All Brands</span>
              </label>
              <div id="brandOptions" className="check-list"></div>
            </div>
          </div>
          <label className="select-field">
            <span>Rows</span>
            <select id="pageSize" defaultValue="25">
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
          </label>
          <div id="shownCount" className="shown-count">0 players shown</div>
        </div>

        <div id="tableStatus" className="table-status" role="status" aria-live="polite"></div>
        <div className="table-wrap">
          <table id="playersTable">
            <thead id="tableHead"></thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>

        <footer className="pagination">
          <button id="prevPage" className="button ghost" type="button">Previous</button>
          <span id="pageInfo">Page 1 of 1</span>
          <button id="nextPage" className="button ghost" type="button">Next</button>
        </footer>
      </section>

      <script src="/scripts/app.js" type="module" />
    </main>
  );
}
