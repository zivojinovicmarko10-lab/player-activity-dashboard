import { ApiPlayerRepository } from "./apiPlayerRepository.js";
import { MockPlayerRepository } from "./mockPlayerRepository.js";

export function createPlayerRepository() {
  const apiRepository = new ApiPlayerRepository();
  return apiRepository.isConfigured() ? apiRepository : new MockPlayerRepository();
}
