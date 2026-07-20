export const config = {
  port: Number(process.env.PORT || 4173),
  authToken: process.env.VIP_DASHBOARD_TOKEN || "",
  refreshSeconds: Number(process.env.VIP_REFRESH_SECONDS || 45),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
