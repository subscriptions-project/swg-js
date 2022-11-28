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
import {warn} from './log';

// NOTE: This regex was copied from SwG's AMP extension. https://github.com/ampproject/amphtml/blob/c23bf281f817a2ee5df73f6fd45e9f4b71bb68b6/extensions/amp-subscriptions-google/0.1/amp-subscriptions-google.js#L56
const GOOGLE_DOMAIN_RE = /(^|\.)google\.(com?|[a-z]{2}|com?\.[a-z]{2}|cat)$/;

/**
  @typedef {{
    href: string,
    protocol: string,
    host: string,
    hostname: string,
    port: string,
    pathname: string,
    search: string,
    hash: string,
    origin: string,
  }}
  */
let LocationDef;

/**
 * Cached a-tag to avoid memory allocation during URL parsing.
 * @type {HTMLAnchorElement}
 */
let a;

/**
 * We cached all parsed URLs. As of now there are no use cases
 * of AMP docs that would ever parse an actual large number of URLs,
 * but we often parse the same one over and over again.
 * @type {Object<string, !LocationDef>}
 */
let cache;

/**
 * Returns a Location-like object for the given URL. If it is relative,
 * the URL gets resolved.
 * Consider the returned object immutable. This is enforced during
 * testing by freezing the object.
 * @param {string} url
 * @return {!LocationDef}
 */
export function parseUrl(url) {
  if (!a) {
    a = /** @type {!HTMLAnchorElement} */ (self.document.createElement('a'));
    cache = self.UrlCache || (self.UrlCache = Object.create(null));
  }

  const fromCache = cache[url];
  if (fromCache) {
    return fromCache;
  }

  const info = parseUrlWithA(a, url);

  return (cache[url] = info);
}

/**
 * Returns a Location-like object for the given URL. If it is relative,
 * the URL gets resolved.
 * @param {!HTMLAnchorElement} a
 * @param {string} url
 * @return {!LocationDef}
 */
function parseUrlWithA(a, url) {
  a.href = url;

  /** @type {!LocationDef} */
  const info = {
    href: a.href,
    protocol: a.protocol,
    host: a.host,
    hostname: a.hostname,
    port: a.port == '0' ? '' : a.port,
    pathname: a.pathname,
    search: a.search,
    hash: a.hash,
    origin: a.protocol + '//' + a.host,
  };

  // For data URI a.origin is equal to the string 'null' which is not useful.
  // We instead return the actual origin which is the full URL.
  if (a.origin && a.origin !== 'null') {
    info.origin = a.origin;
  } else if (info.protocol === 'data:' || !info.host) {
    info.origin = info.href;
  }
  return info;
}

/**
 * Parses and builds Object of URL query string.
 * @param {string} query The URL query string.
 * @return {!Object<string, string>}
 */
export function parseQueryString(query) {
  if (!query) {
    return {};
  }
  return (/^[?#]/.test(query) ? query.slice(1) : query)
    .split('&')
    .reduce((params, param) => {
      const item = param.split('=');
      try {
        const key = decodeURIComponent(item[0] || '');
        const value = decodeURIComponent(item[1] || '');
        if (key) {
          params[key] = value;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        warn(`SwG could not parse a URL query param: ${item[0]}`);
      }
      return params;
    }, {});
}

/**
 * Adds a parameter to a query string.
 * @param {string} url
 * @param {string} param
 * @param {string} value
 * @return {string}
 */
export function addQueryParam(url, param, value) {
  const queryIndex = url.indexOf('?');
  const fragmentIndex = url.indexOf('#');
  let fragment = '';
  if (fragmentIndex != -1) {
    fragment = url.substring(fragmentIndex);
    url = url.substring(0, fragmentIndex);
  }
  if (queryIndex == -1) {
    url += '?';
  } else if (queryIndex < url.length - 1) {
    url += '&';
  }
  url += encodeURIComponent(param) + '=' + encodeURIComponent(value);
  return url + fragment;
}

/**
 * @param {!../proto/api_messages.Message} message
 * @return {string}
 */
export function serializeProtoMessageForUrl(message) {
  return JSON.stringify(message.toArray(false));
}

/**
 * Returns the canonical URL from the canonical tag. If the canonical tag is
 * not present, treat the doc URL itself as canonical.
 * @param {!../model/doc.Doc} doc
 * @return {string}
 */
export function getCanonicalUrl(doc) {
  const rootNode = doc.getRootNode();
  const canonicalTag = rootNode.querySelector("link[rel='canonical']");
  return (
    canonicalTag?.href || rootNode.location.origin + rootNode.location.pathname
  );
}

const PARSED_URL = parseUrl(self.window.location.href);
const PARSED_REFERRER = parseUrl(self.document.referrer);

/**
 * True for Google domains
 * @param {LocationDef=} parsedUrl Defaults to the current page's URL
 * @return {boolean}
 */
function isGoogleDomain(parsedUrl) {
  parsedUrl = parsedUrl || PARSED_URL;
  return GOOGLE_DOMAIN_RE.test(parsedUrl.hostname);
}

/**
 * True for HTTPS URLs
 * @param {LocationDef=} parsedUrl Defaults to the current page's URL
 * @return {boolean}
 */
export function isSecure(parsedUrl) {
  parsedUrl = parsedUrl || PARSED_URL;
  return parsedUrl.protocol === 'https' || parsedUrl.protocol === 'https:';
}

/**
 * True when the page is rendered within a secure Google application or
 * was linked to from a secure Google domain.
 * @param {LocationDef=} parsedReferrer Defaults to the current page's referrer
 * @return {boolean}
 */
export function wasReferredByGoogle(parsedReferrer) {
  parsedReferrer = parsedReferrer || PARSED_REFERRER;
  return isSecure(parsedReferrer) && isGoogleDomain(parsedReferrer);
}
