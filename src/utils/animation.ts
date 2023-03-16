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

import {setImportantStyles} from './style';

/**
 * Returns a promise which is resolved after the given duration of animation
 * @param el - Element to be observed.
 * @param props - properties to be animated.
 * @param durationMillis - duration of animation.
 * @param curve - transition function for the animation.
 * @return Promise which resolves once the animation is done playing.
 */
export async function transition(
  el: HTMLElement,
  props: {[key: string]: string},
  durationMillis: number,
  curve: string
): Promise<void> {
  const win = el.ownerDocument.defaultView!;
  const previousTransitionValue = el.style.transition || '';

  await new Promise((resolve) => {
    win.setTimeout(() => {
      win.setTimeout(resolve, durationMillis);
      const tr = `${durationMillis}ms ${curve}`;
      setImportantStyles(
        el,
        Object.assign(
          {
            'transition': `transform ${tr}, opacity ${tr}`,
          },
          props
        )
      );
    });
  });

  setImportantStyles(el, {
    'transition': previousTransitionValue,
  });
}
