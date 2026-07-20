const DAY_MS = 24 * 60 * 60 * 1000;

export const columns = [
  { key: "casinoBrand", label: "Casino/Brand", type: "text" },
  { key: "username", label: "Username", type: "text" },
  { key: "email", label: "Email Address", type: "text" },
  { key: "totalDepositsLifetime", label: "Total Deposits Lifetime", type: "money" },
  { key: "totalDeposits7d", label: "Total Deposits (Last 7 Days)", type: "money" },
  { key: "totalWithdrawalsLifetime", label: "Total Withdrawals Lifetime", type: "money" },
  { key: "totalWithdrawals7d", label: "Total Withdrawals (Last 7 Days)", type: "money" },
  { key: "lastDepositDate", label: "Last Deposit Date", type: "date" },
  { key: "lastLogin", label: "Last Login", type: "date" },
  { key: "depositActivityStatus", label: "Deposit Activity Status", type: "status" },
  { key: "netLifetime", label: "Net Lifetime", type: "money" },
  { key: "net7d", label: "Net Last 7 Days", type: "money" },
  { key: "playerClass", label: "Player Class", type: "text" }
];

export const sortableKeys = new Set(columns.map((column) => column.key));

export function calendarDayDiff(dateValue, now = new Date()) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dateUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((todayUtc - dateUtc) / DAY_MS);
}

export function getDepositStatus(lastDepositDate, now = new Date()) {
  const days = calendarDayDiff(lastDepositDate, now);
  if (days === null) {
    return {
      code: "no_deposit_date",
      label: "No Deposit Date",
      badge: "No Deposit Date",
      rowTone: "risk"
    };
  }
  if (days <= 3) {
    return {
      code: "active",
      label: "Active",
      badge: "Active (0-3 Days)",
      rowTone: "active"
    };
  }
  if (days <= 7) {
    return {
      code: "cooling",
      label: "Cooling",
      badge: "Cooling (4-7 Days)",
      rowTone: "cooling"
    };
  }
  return {
    code: "at_risk",
    label: "At Risk",
    badge: "At Risk (7+ Days)",
    rowTone: "risk"
  };
}

export function enrichPlayer(player, now = new Date()) {
  const totalDepositsLifetime = Number(player.totalDepositsLifetime || 0);
  const totalDeposits7d = Number(player.totalDeposits7d || 0);
  const totalWithdrawalsLifetime = Number(player.totalWithdrawalsLifetime || 0);
  const totalWithdrawals7d = Number(player.totalWithdrawals7d || 0);
  const status = getDepositStatus(player.lastDepositDate, now);

  return {
    ...player,
    totalDepositsLifetime,
    totalDeposits7d,
    totalWithdrawalsLifetime,
    totalWithdrawals7d,
    netLifetime: totalDepositsLifetime - totalWithdrawalsLifetime,
    net7d: totalDeposits7d - totalWithdrawals7d,
    depositActivityStatus: status.label,
    depositActivityBadge: status.badge,
    depositActivityCode: status.code,
    rowTone: status.rowTone
  };
}

export function matchesActivityFilter(player, filter, now = new Date()) {
  const days = calendarDayDiff(player.lastDepositDate, now);
  switch (filter) {
    case "today":
      return days === 0;
    case "last3":
      return days !== null && days <= 3;
    case "last7":
      return days !== null && days <= 7;
    case "risk7":
      return days !== null && days > 7;
    case "all":
    default:
      return days !== null;
  }
}

export function getSummary(players, now = new Date()) {
  return players.reduce(
    (summary, player) => {
      const days = calendarDayDiff(player.lastDepositDate, now);
      summary.totalPlayers += 1;
      if (days === 0) summary.depositedToday += 1;
      if (days !== null && days <= 3) summary.depositedLast3Days += 1;
      if (days !== null && days > 7) summary.atRiskPlayers += 1;
      summary.totalDepositsToday += Number(player.depositsToday || 0);
      summary.totalDepositsLast7Days += Number(player.totalDeposits7d || 0);
      summary.totalWithdrawalsToday += Number(player.withdrawalsToday || 0);
      summary.totalWithdrawalsLast7Days += Number(player.totalWithdrawals7d || 0);
      return summary;
    },
    {
      totalPlayers: 0,
      depositedToday: 0,
      depositedLast3Days: 0,
      atRiskPlayers: 0,
      totalDepositsToday: 0,
      totalDepositsLast7Days: 0,
      totalWithdrawalsToday: 0,
      totalWithdrawalsLast7Days: 0
    }
  );
}
