/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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
 * @fileoverview
 * The entry point for Showcase (swg-gaa.js).
 */

import {
  GaaGoogle3pSignInButton,
  GaaGoogleSignInButton,
  GaaMetering,
  GaaMeteringRegwall,
  GaaSignInWithGoogleButton,
} from './runtime/extended-access';
import {INTERNAL_RUNTIME_VERSION} from './constants';
import {log} from './utils/log';

log(`Subscriptions Showcase Version: ${INTERNAL_RUNTIME_VERSION}`);

// Declare global variables.
self.GaaGoogleSignInButton = GaaGoogleSignInButton;
self.GaaGoogle3pSignInButton = GaaGoogle3pSignInButton;
self.GaaSignInWithGoogleButton = GaaSignInWithGoogleButton;
self.GaaMeteringRegwall = GaaMeteringRegwall;
self.GaaMetering = GaaMetering;
