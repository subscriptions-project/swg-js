/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Timestamp} from '../proto/api_messages';

/**
 * @param {!number} millis
 * @return {!Timestamp}
 */
export function toTimestamp(millis) {
  return new Timestamp(
    [Math.floor(millis / 1000), (millis % 1000) * 1000000],
    false
  );
}

/**
 * @param {!number} timestamp represented as seconds, milliseconds or microseconds
 * @return {!number}
 */
export function convertPotentialTimestampToSeconds(timestamp) {
  let timestampInSeconds;
  if (timestamp >= 1e14 || timestamp <= -1e14) {
    // Microseconds
    timestampInSeconds = Math.floor(timestamp / 1000000);
  } else if (timestamp >= 1e11 || timestamp <= -3e10) {
    // Milliseconds
    timestampInSeconds = Math.floor(timestamp / 1000);
  } else {
    // Seconds
    timestampInSeconds = timestamp;
  }
  return timestampInSeconds;
}
