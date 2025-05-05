/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License atCONST_GOOGLE_LOGO
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Deps} from '../runtime/deps';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {feUrl} from '../runtime/services';
import {msg} from '../utils/i18n';

/** Show a toast idicating that reader has already registered before. */
export function showAlreadyOptedInToast(
  actionType: string,
  lang: string,
  deps: Deps
): void {
  let urlParams;
  switch (actionType) {
    case 'TYPE_REGISTRATION_WALL':
      // Show 'Signed in as abc@gmail.com' toast on the pub page.
      urlParams = {
        flavor: 'basic',
      };
      break;
    case 'TYPE_NEWSLETTER_SIGNUP':
      const customText = msg(
        SWG_I18N_STRINGS.NEWSLETTER_ALREADY_SIGNED_UP_LANG_MAP,
        lang
      )!;
      urlParams = {
        flavor: 'custom',
        customText,
      };
      break;
    default:
      // Do not show toast for other types.
      return;
  }
  new Toast(deps, feUrl('/toastiframe', urlParams)).open();
}
