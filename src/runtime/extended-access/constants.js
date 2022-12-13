/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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

/** Stamp for post messages. */
export const POST_MESSAGE_STAMP = 'swg-gaa-post-message-stamp';

/** Introduction command for post messages. */
export const POST_MESSAGE_COMMAND_INTRODUCTION = 'introduction';

/** User command for post messages. */
export const POST_MESSAGE_COMMAND_USER = 'user';

/** Error command for post messages. */
export const POST_MESSAGE_COMMAND_ERROR = 'error';

/** GSI Button click command for post messages. */
export const POST_MESSAGE_COMMAND_GSI_BUTTON_CLICK = 'gsi-button-click';

/** SIWG Button click command for post messages. */
export const POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK = 'siwg-button-click';

/** 3P button click command for post messages. */
export const POST_MESSAGE_COMMAND_3P_BUTTON_CLICK = '3p-button-click';

/** Delay used to log 3P button click before redirect */
export const REDIRECT_DELAY = 10;

/**
 * Types of grantReason that can be specified by the user as part of
 * the userState object
 * @enum {string}
 */
export const GrantReasonType = {
  FREE: 'FREE',
  SUBSCRIBER: 'SUBSCRIBER',
  METERING: 'METERING',
};

/**
 * Types of paywallReason that can be specified by the user as part of
 * the userState object
 * @enum {string}
 */
export const PaywallReasonType = {
  RESERVED_USER: 'RESERVED_USER',
};
