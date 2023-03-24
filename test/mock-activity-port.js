import {ActivityPort} from '../src/components/activities';

/**
 * This mock exists for unit tests.
 * @implements {ActivityPort}
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
