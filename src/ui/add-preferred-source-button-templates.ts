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

const css = String.raw;

/**
 * Design token definitions for Light and Dark themes.
 */
interface ThemeTokens {
  containerColor: string;
  outlineColor: string;
  labelTextColor: string;
  hoverContainerColor: string;
  hoverOutlineColor: string;
  hoverLabelTextColor: string;
  hoverBoxShadow: string;
  pressedContainerColor: string;
  pressedOutlineColor: string;
  pressedLabelTextColor: string;
  disabledContainerColor: string;
  disabledOutlineColor: string;
  disabledLabelTextColor: string;
}

const LIGHT_THEME: ThemeTokens = {
  containerColor: '#ffffff',
  outlineColor: '#c4c7c5',
  labelTextColor: '#1f1f1f',
  hoverContainerColor: '#f8f9fa',
  hoverOutlineColor: '#c4c7c5',
  hoverLabelTextColor: '#1f1f1f',
  hoverBoxShadow:
    '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)',
  pressedContainerColor: '#f1f3f4',
  pressedOutlineColor: '#c4c7c5',
  pressedLabelTextColor: '#1f1f1f',
  disabledContainerColor: '#e1e3e1',
  disabledOutlineColor: '#e1e3e1',
  disabledLabelTextColor: '#747775',
};

const DARK_THEME: ThemeTokens = {
  containerColor: '#202124',
  outlineColor: '#5f6368',
  labelTextColor: '#e8eaed',
  hoverContainerColor: '#303134',
  hoverOutlineColor: '#5f6368',
  hoverLabelTextColor: '#e8eaed',
  hoverBoxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  pressedContainerColor: '#35363a',
  pressedOutlineColor: '#5f6368',
  pressedLabelTextColor: '#e8eaed',
  disabledContainerColor: '#202124',
  disabledOutlineColor: '#3c4043',
  disabledLabelTextColor: '#80868b',
};

function renderThemeProperties(tokens: ThemeTokens): string {
  return css`
    --md-outlined-button-container-color: ${tokens.containerColor};
    --md-outlined-button-outline-color: ${tokens.outlineColor};
    --md-outlined-button-label-text-color: ${tokens.labelTextColor};
    --md-outlined-button-hover-container-color: ${tokens.hoverContainerColor};
    --md-outlined-button-hover-outline-color: ${tokens.hoverOutlineColor};
    --md-outlined-button-hover-label-text-color: ${tokens.hoverLabelTextColor};
    --md-outlined-button-hover-box-shadow: ${tokens.hoverBoxShadow};
    --md-outlined-button-pressed-container-color: ${tokens.pressedContainerColor};
    --md-outlined-button-pressed-outline-color: ${tokens.pressedOutlineColor};
    --md-outlined-button-pressed-label-text-color: ${tokens.pressedLabelTextColor};
    --md-outlined-button-disabled-container-color: ${tokens.disabledContainerColor};
    --md-outlined-button-disabled-outline-color: ${tokens.disabledOutlineColor};
    --md-outlined-button-disabled-label-text-color: ${tokens.disabledLabelTextColor};
  `;
}

/**
 * Encapsulated CSS tokens ensuring pixel-perfect parity with Google Design specs.
 *
 * @param theme - Explicit 'light', 'dark', or 'auto' (OS adaptive via media query).
 */
export function getButtonStyles(
  theme?: 'light' | 'dark' | 'auto' | null
): string {
  const isDark = theme === 'dark';
  const isAuto = theme === 'auto' || !theme;
  const initialTokens = isDark ? DARK_THEME : LIGHT_THEME;

  return css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      box-sizing: border-box;
      line-height: normal;
    }
    publisher-md-outlined-button {
      --md-outlined-button-container-height: 40px;
      --md-outlined-button-container-shape: 20px;
      --md-outlined-button-icon-size: 22px;
      --md-outlined-button-with-leading-icon-leading-space: 14px;
      --md-outlined-button-with-leading-icon-trailing-space: 16px;
      --md-outlined-button-leading-space: 14px;
      --md-outlined-button-trailing-space: 16px;
      --md-outlined-button-outline-width: 1px;
      --md-outlined-button-disabled-outline-opacity: 1;
      --md-outlined-button-disabled-container-opacity: 1;
      --md-outlined-button-disabled-label-text-opacity: 1;
      --md-outlined-button-label-text-font:
        'Google Sans Text', Roboto, Helvetica, Arial, sans-serif;
      --md-outlined-button-label-text-size: 14px;
      --md-outlined-button-label-text-weight: 500;
      --md-outlined-button-label-text-tracking: 0.1px;
      ${renderThemeProperties(initialTokens)}
    }
    ${isAuto
      ? css`
          @media (prefers-color-scheme: dark) {
            publisher-md-outlined-button {
              ${renderThemeProperties(DARK_THEME)}
            }
          }
        `
      : ''}
    .publisher-logo {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      display: inline-block;
      vertical-align: middle;
    }
    .publisher-btn-text {
      line-height: 20px;
      white-space: nowrap;
    }
  `;
}
