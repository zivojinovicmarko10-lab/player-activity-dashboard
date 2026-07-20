import { json, repository } from "../../repository.js";

export async function GET(_request, { params }) {
  const player = await repository.getPlayerById(params.id);
  if (!player) return json({ error: "Player not found" }, { status: 404 });
  return json({ data: player, meta: { lastUpdated: new Date().toISOString() } });
}
