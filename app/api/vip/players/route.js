import { json, queryFromRequest, repository } from "../repository.js";

export async function GET(request) {
  return json(await repository.listPlayers(queryFromRequest(request)));
}
