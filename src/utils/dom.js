/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {setStyles} from './style';

/** @const @enum{string} */
export const styleLinkAttrs = {
  'rel': 'stylesheet',
  'type': 'text/css',
};

/** @const {string} */
export const styleExistsQuerySelector = 'head link[rel=stylesheet][href]';


 /**
 * Add attributes to an element.
 * @param {!Element} element
 * @param {!Object<string, *>} attributes
 * @return {!Element} updated element.
 */
export function addAttributesToElement(element, attributes) {
  for (const attr in attributes) {
    if (attr == 'style') {
      setStyles(element, attributes[attr]);
    } else {
      element.setAttribute(attr, attributes[attr]);
    }

  }
  return element;
}


/**
 * Create a new element on document with specified tagName and attributes.
 * @param {!Document} doc
 * @param {string} tagName
 * @param {!Object<string, string>} attributes
 * @return {!Element} created element.
 */
export function createElement(doc, tagName, attributes) {
  const element = doc.createElement(tagName);
  return addAttributesToElement(element, attributes);
}


/**
 * Removes the element.
 * @param {!Element} element
 */
export function removeElement(element) {
  if (element.parentElement) {
    element.parentElement.removeChild(element);
  }
}


/**
 * Injects the provided styles in the HEAD section of the document.
 * @param {!Document} doc The document object.
 * @param {string} styleText The style string.
 * @return {!Element}
 */
export function injectStyleSheet(doc, styleText) {
  const styleElement = createElement(doc, 'style', {});
  styleElement.textContent = styleText;
  doc.head.appendChild(styleElement);
  return styleElement;
}


/**
 * Injects the font Url in the HEAD of the provided document object.
 * @param {!Document} doc The document object.
 * @param {string} fontUrl The Url of the fonts to be inserted.
 * @return {!Document} The document object.
 */
export function injectFontsLink(doc, fontUrl) {

  // Remove any trailing "/".
  /** @type {string} */
  const cleanFontUrl = fontUrl.replace(/\/$/, '');

  if (styleExistsForUrl(doc, cleanFontUrl)) {
    return doc;
  }

  const attrs = styleLinkAttrs;
  attrs.href = cleanFontUrl;
  const linkElement = createElement(doc, 'link', attrs);

  doc.head.appendChild(linkElement);
  return doc;
}

/**
 * Checks if existing link rel stylesheet with the same href exists.
 * @param {!Document} doc The document object.
 * @param {!string} cleanFontUrl The fonts Url.
 * @return {boolean}
 */
function styleExistsForUrl(doc, cleanFontUrl) {
  // Check if existing link rel stylesheet with same href already defined.
  const nodes = Array.prototype.slice
      .call(doc.querySelectorAll(styleExistsQuerySelector));

  return nodes.some(link => {
    return link.href == cleanFontUrl;
  });
}
