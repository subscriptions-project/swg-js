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
  const element = document.createElement('div');
  element.classList.add('header');
  element.innerHTML = `
  <a href="index.html">
    Swgjs Demos
  </a>
  `;

  // Add navigation before the content.
  document.querySelector('.content').before(element);
}

/**
 * Creates a navigation with links.
 */
function createNavigation() {
  const element = document.createElement('div');
  element.classList.add('nav');
  element.innerHTML = `
  <div class="toggle-navigation-button"></div>
  <ul class="nav-list">
    <li><a href="button-light.html">Button (Light)</a></li>
    <li><a href="button-dark.html">Button (Dark)</a></li>
    <li><a href="button-french.html">Button (French)</a></li>
    <li><a href="autoprompt-paywalled.html">Auto Prompt (Paywalled Article)</a></li>
    <li><a href="autoprompt-free.html">Auto Prompt (Free Article)</a></li>
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
