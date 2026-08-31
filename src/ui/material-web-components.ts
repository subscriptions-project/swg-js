/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

import {CSSResultOrNative, css} from 'lit';
import {MdOutlinedButton} from '@material/web/button/outlined-button.js';

export class PublisherOutlinedButton extends MdOutlinedButton {
  static override styles: CSSResultOrNative[] = [
    ...(Array.isArray(MdOutlinedButton.styles)
      ? MdOutlinedButton.styles
      : [MdOutlinedButton.styles]),
    css`
      :host {
        /*
         * EXPLICIT JUSTIFICATION FOR CUSTOM OVERRIDES:
         * 1. Container Background: Standard M3 OutlinedButton defaults to a transparent container
         *    (--_container-color: none). We map --md-outlined-button-container-color so buttons
         *    have opaque backgrounds on publisher pages.
         * 2. Hover Elevation: Google brand spec requires a subtle elevation drop shadow on hover.
         */
        background-color: var(
          --md-outlined-button-container-color,
          transparent
        );
        border-radius: var(--_container-shape-start-start, 20px);
        vertical-align: middle;
        transition: box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
      }
      :host(:hover:not([disabled]):not([soft-disabled])) {
        box-shadow: var(--md-outlined-button-hover-box-shadow, none);
      }
      :host(:is([disabled], [soft-disabled])) {
        background-color: var(
          --md-outlined-button-disabled-container-color,
          transparent
        );
      }
      .outline {
        pointer-events: none;
      }
    `,
  ];
}

if (!customElements.get('publisher-md-outlined-button')) {
  customElements.define('publisher-md-outlined-button', PublisherOutlinedButton);
}
