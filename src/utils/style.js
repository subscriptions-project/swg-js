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

// Note: loaded by 3p system. Cannot rely on babel polyfills.
import {map} from './object.js';
import {startsWith} from './string';

/** @type {Object<string, string>} */
let propertyNameCache;

/** @const {!Array<string>} */
const vendorPrefixes = ['Webkit', 'webkit', 'Moz', 'moz', 'ms', 'O', 'o'];

/** @const {!Array<string>} */
const allStyles = [
  'align-content',
  'align-items',
  'align-self',
  'alignment-baseline',
  'all',
  'backface-visibility',
  'background-attachment',
  'background-blend-mode',
  'background-clip',
  'background-color',
  'background-image',
  'background-origin',
  'background-position-x',
  'background-position-y',
  'background-repeat',
  'background-size',
  'baseline-shift',
  'block-size',
  'border',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-collapse',
  'bottom',
  'box-shadow',
  'box-sizing',
  'break-after',
  'break-before',
  'break-inside',
  'buffered-rendering',
  'caption-side',
  'caret-color',
  'clear',
  'clip',
  'clip-path',
  'clip-rule',
  'color-interpolation',
  'color-interpolation-filters',
  'color-rendering',
  'column-count',
  'column-fill',
  'column-gap',
  'column-rule-color',
  'column-rule-style',
  'column-rule-width',
  'column-span',
  'column-width',
  'contain',
  'content',
  'counter-increment',
  'counter-reset',
  'cursor',
  'cx',
  'cy',
  'd',
  'direction',
  'display',
  'dominant-baseline',
  'empty-cells',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'flex-basis',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'float',
  'flood-color',
  'flood-opacity',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'font-stretch',
  'font-style',
  'font-variant-caps',
  'font-variant-ligatures',
  'font-variant-numeric',
  'font-variation-settings',
  'font-weight',
  'grid-auto-columns',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-column-end',
  'grid-column-gap',
  'grid-column-start',
  'grid-row-end',
  'grid-row-gap',
  'grid-row-start',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'hyphens',
  'image-rendering',
  'inline-size',
  'isolation',
  'justify-content',
  'justify-items',
  'justify-self',
  'letter-spacing',
  'lighting-color',
  'line-break',
  'list-style-image',
  'list-style-position',
  'list-style-type',
  'margin-bottom',
  'margin-right',
  'margin-top',
  'margin-left',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'mask-type',
  'max-block-size',
  'max-height',
  'max-inline-size',
  'max-width',
  'min-block-size',
  'min-height',
  'min-inline-size',
  'min-width',
  'mix-blend-mode',
  'object-fit',
  'object-position',
  'offset-distance',
  'offset-path',
  'offset-rotate',
  'opacity',
  'order',
  'orphans',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'overflow-anchor',
  'overflow-wrap',
  'overflow-x',
  'overflow-y',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'page',
  'paint-order',
  'perspective',
  'perspective-origin',
  'pointer-events',
  'position',
  'quotes',
  'r',
  'resize',
  'right',
  'rx',
  'ry',
  'scroll-behavior',
  'shape-image-threshold',
  'shape-margin',
  'shape-outside',
  'shape-rendering',
  'size',
  'speak',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'tab-size',
  'table-layout',
  'text-align',
  'text-align-last',
  'text-anchor',
  'text-combine-upright',
  'text-decoration-color',
  'text-decoration-line',
  'text-decoration-skip',
  'text-decoration-style',
  'text-indent',
  'text-decoration-color:',
  'text-orientation',
  'text-overflow',
  'text-rendering',
  'text-shadow',
  'text-size-adjust',
  'text-transform',
  'text-underline-position',
  'top',
  'touch-action',
  'transform',
  'transform-origin',
  'transform-style',
  'transition-delay',
  'transition-duration',
  'transition-property',
  'transition-timing-function',
  'unicode-bidi',
  'user-select',
  'vector-effect',
  'vertical-align',
  'visibility',
  'white-space',
  'widows',
  'will-change',
  'word-break',
  'word-spacing',
  'word-wrap',
  'writing-mode',
  'x',
  'y',
  'zoom',
  'z-index',
];

/** @const {string} */
const googleFontsUrl =
    'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';

/** @const {!Object<string|number} */
const friendlyIframeAttributes = {
  'frameborder': 0,
  'scrolling': 'no',
  'src': 'about:blank',
};

/**
 * Default overwritable styles. This is required for responsive dialog.
 * @const {!Object<string, string|number}
 */
const topFriendlyIframeStyles = {
  'width': '100%',
  'left': 0,
};

/**
 * Default iframe important styles.
 * Note: The iframe responsiveness media query style is injected in the
 * publisher's page since style attribute can not include media query.
 * @const {!Object<string, string|number}
 */
const topFriendlyIframeImportantStyles = {
  'min-height': '50px',
  'opacity': 1,
  'border': 'none',
  'display': 'block',
  'background-color': 'rgb(255, 255, 255)',
  'position': 'fixed',
  'bottom': '0px',
  'z-index': '2147483647',
  'box-shadow': 'gray 0px 3px, gray 0px 0px 22px',
  'box-sizing': 'border-box',
};


/**
 * Gets all the possible styles for an element.
 * @return {!Array<string>}
 */
export function getAllStyles() {
  return allStyles;
}


/** @return {!Object<string, string|number} */
export function getTopFriendlyIframeStyles() {
  return topFriendlyIframeStyles;
}


/** @return {!Object<string, string|number} */
export function getTopFriendlyIframeImportantStyles() {
  return topFriendlyIframeImportantStyles;
}


/** @return {string} */
export function getGoogleFontsUrl() {
  return googleFontsUrl;
}


/** @return {!Object<string|number} */
export function getFriendlyIframeAttributes() {
  return friendlyIframeAttributes;
}


/**
 * @export
 * @param {string} camelCase camel cased string
 * @return {string} title cased string
 */
export function camelCaseToTitleCase(camelCase) {
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Checks the style if a prefixed version of a property exists and returns
 * it or returns an empty string.
 * @private
 * @param {!Object} style
 * @param {string} titleCase the title case version of a css property name
 * @return {string} the prefixed property name or null.
 */
function getVendorJsPropertyName_(style, titleCase) {
  for (let i = 0; i < vendorPrefixes.length; i++) {
    const propertyName = vendorPrefixes[i] + titleCase;
    if (style[propertyName] !== undefined) {
      return propertyName;
    }
  }
  return '';
}

/**
 * Returns the possibly prefixed JavaScript property name of a style property
 * (ex. WebkitTransitionDuration) given a camelCase'd version of the property
 * (ex. transitionDuration).
 * @export
 * @param {!Object} style
 * @param {string} camelCase the camel cased version of a css property name
 * @param {boolean=} opt_bypassCache bypass the memoized cache of property
 *   mapping
 * @return {string}
 */
export function getVendorJsPropertyName(style, camelCase, opt_bypassCache) {
  if (startsWith(camelCase, '--')) {
    // CSS vars are returned as is.
    return camelCase;
  }
  if (!propertyNameCache) {
    propertyNameCache = map();
  }
  let propertyName = propertyNameCache[camelCase];
  if (!propertyName || opt_bypassCache) {
    propertyName = camelCase;
    if (style[camelCase] === undefined) {
      const titleCase = camelCaseToTitleCase(camelCase);
      const prefixedPropertyName = getVendorJsPropertyName_(style, titleCase);

      if (style[prefixedPropertyName] !== undefined) {
        propertyName = prefixedPropertyName;
      }
    }
    if (!opt_bypassCache) {
      propertyNameCache[camelCase] = propertyName;
    }
  }
  return propertyName;
}


/**
 * Sets the CSS styles of the specified element with !important. The styles
 * are specified as a map from CSS property names to their values.
 * @param {!Element} element
 * @param {!Object<string, string|number>} styles
 */
export function setImportantStyles(element, styles) {
  for (const k in styles) {
    element.style.setProperty(
        getVendorJsPropertyName(styles, k), styles[k].toString(), 'important');
  }
}


/**
 * Sets the CSS style of the specified element with optional units, e.g. "px".
 * @param {Element} element
 * @param {string} property
 * @param {?string|number|boolean} value
 * @param {string=} opt_units
 * @param {boolean=} opt_bypassCache
 */
export function setStyle(element, property, value, opt_units, opt_bypassCache) {
  const propertyName = getVendorJsPropertyName(element.style, property,
      opt_bypassCache);
  if (propertyName) {
    element.style[propertyName] =
        /** @type {string} */ (opt_units ? value + opt_units : value);
  }
}


/**
 * Returns the value of the CSS style of the specified element.
 * @param {!Element} element
 * @param {string} property
 * @param {boolean=} opt_bypassCache
 * @return {*}
 */
export function getStyle(element, property, opt_bypassCache) {
  const propertyName = getVendorJsPropertyName(element.style, property,
      opt_bypassCache);
  if (!propertyName) {
    return undefined;
  }
  return element.style[propertyName];
}


/**
 * Sets the CSS styles of the specified element. The styles
 * a specified as a map from CSS property names to their values.
 * @param {!Element} element
 * @param {!Object<string, ?string|number|boolean>} styles
 */
export function setStyles(element, styles) {
  for (const k in styles) {
    setStyle(element, k, styles[k]);
  }
}


/**
 * Shows or hides the specified element.
 * @param {!Element} element
 * @param {boolean=} opt_display
 */
export function toggle(element, opt_display) {
  if (opt_display === undefined) {
    opt_display = getStyle(element, 'display') == 'none';
  }
  setStyle(element, 'display', opt_display ? '' : 'none');
}


/**
 * Returns a pixel value.
 * @param {number} value
 * @return {string}
 */
export function px(value) {
  return value + 'px';
}


/**
 * Returns a "translateX" for CSS "transform" property.
 * @param {number|string} value
 * @return {string}
 */
export function translateX(value) {
  if (typeof value == 'string') {
    return `translateX(${value})`;
  }
  return `translateX(${px(value)})`;
}


/**
 * Returns a "translateX" for CSS "transform" property.
 * @param {number|string} x
 * @param {(number|string)=} opt_y
 * @return {string}
 */
export function translate(x, opt_y) {
  if (typeof x == 'number') {
    x = px(x);
  }
  if (opt_y === undefined) {
    return `translate(${x})`;
  }
  if (typeof opt_y == 'number') {
    opt_y = px(opt_y);
  }
  return `translate(${x}, ${opt_y})`;
}


/**
 * Returns a "scale" for CSS "transform" property.
 * @param {number|string} value
 * @return {string}
 */
export function scale(value) {
  return `scale(${value})`;
}


/**
 * Remove alpha value from a rgba color value.
 * Return the new color property with alpha equals if has the alpha value.
 * Caller needs to make sure the input color value is a valid rgba/rgb value
 * @param {string} rgbaColor
 * @return {string}
 */
export function removeAlphaFromColor(rgbaColor) {
  return rgbaColor.replace(
      /\(([^,]+),([^,]+),([^,)]+),[^)]+\)/g, '($1,$2,$3, 1)');
}


/**
 * Gets the computed style of the element. The helper is necessary to enforce
 * the possible `null` value returned by a buggy Firefox.
 *
 * @param {!Window} win
 * @param {!Element} el
 * @return {!Object<string, string>}
 */
export function computedStyle(win, el) {
  const style = /** @type {?CSSStyleDeclaration} */(win.getComputedStyle(el));
  return /** @type {!Object<string, string>} */(style) || map();
}


/**
 * Resets styles that were set dynamically (i.e. inline)
 * @param {!Element} element
 * @param {!Array<string>} properties
 */
export function resetStyles(element, properties) {
  const styleObj = {};
  properties.forEach(prop => {
    styleObj[prop] = null;
  });
  setStyles(element, styleObj);
}


/**
 * Resets all the styles of an element to a given value. Defaults to null.
 * The valid values are 'inherit', 'initial', 'unset' or null.
 */
export function resetAllStylesWith(element, value = null) {
  const validValues = ['inherit', 'initial', 'unset'];
  if (value != null && !validValues.find(item => item == value)) {
    throw Error(`Invalid value. Valid values are ${validValues.join(',')}`);
  }
  const styleObj = {};
  getAllStyles().forEach(prop => {
    styleObj[prop] = value;
  });
  setStyles(element, styleObj);
}
