/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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

// Render demo.
(async () => {
  createHeader();
  createNavigation();

  // Reveal website, after all the HTML is added.
  document.body.classList.add('revealed');
})();

/**
 * Creates a header.
 */
function createHeader() {
  const environment = location.pathname.match('/qual/') ? 'Qual' : '';
  const element = document.createElement('div');
  element.classList.add('header');
  element./*OK*/ innerHTML = `
  <a href="index.html">
    Swgjs Demos
  </a>
  <span class="environment">${environment}</span>
  `;

  // Add header before the content.
  document.querySelector('.content').before(element);
}

/**
 * Creates a navigation with links.
 */
function createNavigation() {
  const element = document.createElement('div');
  element.classList.add('nav');
  element./*OK*/ innerHTML = `
  <div class="toggle-navigation-button"></div>
  <ul class="nav-list">
    <li><a href="button-light.html">Button (Light)</a></li>
    <li><a href="button-dark.html">Button (Dark)</a></li>
    <li><a href="button-french.html">Button (French)</a></li>
    <li><a href="autoprompt-paywalled.html">Auto Prompt (Paywalled Article)</a></li>
    <li><a href="autoprompt-free.html">Mini Auto Prompt (Free Article)</a></li>
    <li><a href="autoprompt-large-free.html">Large Auto Prompt (Free Article)</a></li>
    <li><a href="free-article.html">Free Article</a></li>
  </ul>
  `;

  // Handle click events.
  const button = element.querySelector('.toggle-navigation-button');
  button.addEventListener('click', () => {
    document.body.classList.toggle('mobile-navigation-is-expanded');
  });

  // Add navigation before the content.
  document.querySelector('.content').before(element);
}
