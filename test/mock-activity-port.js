import {ActivityPort as ActivityPortDef} from '../src/components/activities';

/**
 * This mock exists for unit tests.
 * @implements {ActivityPortDef}
 */
export class MockActivityPort {
  getMode() {}
  acceptResult() {}
  whenReady() {}
  connect() {}
  disconnect() {}
  onResizeRequest() {}
  execute() {}
  on() {}
  resized() {}
}
