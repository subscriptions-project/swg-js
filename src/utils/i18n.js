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

/** English is the default language. */
const DEFAULT_LANGUAGE_CODE = 'en';

/**
 * Gets a message for a given language code, from a map of messages.
 * @param {!Object<string, string>} map
 * @param {?string|?Element} languageCodeOrElement
 * @return {?string}
 */
export function msg(map, languageCodeOrElement) {
  const defaultMsg = map[DEFAULT_LANGUAGE_CODE];

  // Verify params.
  if (typeof map !== 'object' || !languageCodeOrElement) {
    return defaultMsg;
  }

  // Get language code.
  let languageCode =
    typeof languageCodeOrElement === 'string'
      ? languageCodeOrElement
      : getLanguageCodeFromElement(languageCodeOrElement);

  // Normalize language code.
  languageCode = languageCode.toLowerCase();
  languageCode = languageCode.replace(/_/g, '-');

  // Search for a message matching the language code.
  // If a message can't be found, try again with a less specific language code.
  const languageCodeSegments = languageCode.split('-');
  while (languageCodeSegments.length) {
    const key = languageCodeSegments.join('-');
    if (key in map) {
      return map[key];
    }

    // Simplify language code.
    // Ex: "en-US-SF" => "en-US"
    languageCodeSegments.pop();
  }

  // There was an attempt.
  return defaultMsg;
}

/**
 * Gets a language code (ex: "en-US") from a given Element.
 * @param {!Element} element
 * @return {string}
 */
function getLanguageCodeFromElement(element) {
  if (element.lang) {
    // Get language from element itself.
    return element.lang;
  }

  if (element.ownerDocument && element.ownerDocument.documentElement.lang) {
    // Get language from element's document.
    return element.ownerDocument.documentElement.lang;
  }

  // There was an attempt.
  return DEFAULT_LANGUAGE_CODE;
}
