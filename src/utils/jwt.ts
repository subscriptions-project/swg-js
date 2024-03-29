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

import {base64UrlDecodeToBytes, utf8DecodeSync} from './bytes';
import {tryParseJson} from './json';

interface JwtTokenInternalDef {
  header: unknown;
  payload: unknown;
  verifiable: string;
  sig: string;
}

/**
 * Provides helper methods to decode and verify JWT tokens.
 */
export class JwtHelper {
  constructor() {}

  /**
   * Decodes JWT token and returns its payload.
   */
  decode(encodedToken: string): unknown {
    return this.decodeInternal_(encodedToken).payload;
  }

  private decodeInternal_(encodedToken: string): JwtTokenInternalDef {
    // See https://jwt.io/introduction/
    /**
     * Throws error about invalid token.
     */
    function invalidToken() {
      throw new Error(`Invalid token: "${encodedToken}"`);
    }

    // Encoded token has three parts: header.payload.sig
    // Note! The padding is not allowed by JWT spec:
    // http://self-issued.info/docs/draft-goland-json-web-token-00.html#rfc.section.5
    const parts = encodedToken.split('.');
    if (parts.length != 3) {
      invalidToken();
    }
    const headerUtf8Bytes = base64UrlDecodeToBytes(parts[0]);
    const payloadUtf8Bytes = base64UrlDecodeToBytes(parts[1]);
    return {
      header: tryParseJson(utf8DecodeSync(headerUtf8Bytes), invalidToken),
      payload: tryParseJson(utf8DecodeSync(payloadUtf8Bytes), invalidToken),
      verifiable: `${parts[0]}.${parts[1]}`,
      sig: parts[2],
    };
  }
}
