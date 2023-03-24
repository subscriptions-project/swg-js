import {DepsDef} from '../src/runtime/deps';

/**
 * This mock exists for unit tests.
 * @implements {DepsDef}
 */
export class MockDeps {
  doc() {}
  win() {}
  config() {}
  pageConfig() {}
  activities() {}
  payClient() {}
  dialogManager() {}
  entitlementsManager() {}
  callbacks() {}
  storage() {}
  analytics() {}
  jserror() {}
  eventManager() {}
  clientConfigManager() {}
}
