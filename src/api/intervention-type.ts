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

/**
 * Intervention types that can be returned from the article endpoint.
 */
export enum InterventionType {
  TYPE_REGISTRATION_WALL = 'TYPE_REGISTRATION_WALL',
  TYPE_NEWSLETTER_SIGNUP = 'TYPE_NEWSLETTER_SIGNUP',
  TYPE_REWARDED_SURVEY = 'TYPE_REWARDED_SURVEY',
  TYPE_REWARDED_AD = 'TYPE_REWARDED_AD',
  TYPE_CONTRIBUTION = 'TYPE_CONTRIBUTION',
  TYPE_SUBSCRIPTION = 'TYPE_SUBSCRIPTION',
  TYPE_BYO_CTA = 'TYPE_BYO_CTA',
}
