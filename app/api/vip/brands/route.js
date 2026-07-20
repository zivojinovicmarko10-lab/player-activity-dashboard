import { json, repository } from "../repository.js";

export async function GET() {
  return json(await repository.listBrands());
}
