/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

/**
 * Parses the given `json` string without throwing an exception if not valid.
 * Returns `undefined` if parsing fails.
 * Returns the `Object` corresponding to the JSON string when parsing succeeds.
 * @param json JSON string to parse
 * @param onFailed Optional function that will be called
 *     with the error if parsing fails.
 * @return Value parsed from JSON.
 */
export function tryParseJson(
  json: string,
  onFailed?: (err: Error) => void
): any {
  try {
    return JSON.parse(json);
  } catch (err: any) {
    if (onFailed) {
      onFailed(err);
    }
    return undefined;
  }
}

/**
 * Converts the passed string into a JSON object (if possible) and returns the
 * value of the propertyName on that object.
 */
export function getPropertyFromJsonString(
  jsonString: string,
  propertyName: string
): any {
  const json = tryParseJson(jsonString);
  return (json && json[propertyName]) || null;
}
