import { createPlayerRepository } from "../../../backend/repositoryFactory.js";

export const repository = createPlayerRepository();

export function queryFromRequest(request) {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

export function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "x-content-type-options": "nosniff",
      ...(init.headers || {})
    }
  });
}
