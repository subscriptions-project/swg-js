const $ = document.querySelector.bind(document);

// eslint-disable-next-line no-undef
const ampVersion = AMP[0].f.toString().match(/"SwG (0\.1\..+?)"/)[1];

const prInput = $('input');
const status = $('.status');
const form = $('form');
form.addEventListener('submit', (e) => {
  e.preventDefault();

  trackPr();
});

async function trackPr() {
  clear();
  log('⏳');

  const prNumber = Number(prInput.value);
  location.hash = prNumber;
  const prPromise = fetch(
    'https://api.github.com/repos/subscriptions-project/swg-js/pulls/' +
      prNumber
  ).then((res) => res.json());
  const releasesPromise = fetch(
    'https://api.github.com/repos/subscriptions-project/swg-js/releases'
  ).then((res) => res.json());
  const rateLimitPromise = fetch(
    'https://api.github.com/rate_limit'
  ).then((res) => res.json());

  const pr = await prPromise;
  if (pr.message && pr.message.match(/rate limit exceeded/)) {
    clear();
    const rateLimit = await rateLimitPromise;
    const resetTimestampInSeconds = rateLimit.rate.reset;
    const resetDate = new Date(resetTimestampInSeconds * 1000);
    const resetDateString = resetDate.toLocaleTimeString();
    log('GitHub is rate limiting you until ' + resetDateString);
    return;
  }
  if (!pr.merged) {
    clear();
    log('This PR is not merged.');
    return;
  }

  clear();

  const releases = await releasesPromise;
  // Find the first release in the list that includes the PR.
  releases.reverse();
  const release = releases.find(
    (release) => release.published_at > pr.merged_at
  );
  if (!release) {
    log('This PR is not released.');
  } else {
    const inAmp = ampVersion >= release.tag_name;
    const inSwg = self.swgVersion >= release.tag_name;

    if (inSwg) {
      if (inAmp) {
        log('This PR is fully released!');
      } else {
        log('This PR is partially released. You can use it outside of AMP!');
      }
    } else {
      log('This PR is releasing now. Check back soon!');
    }
  }

  log('');
  log('# Details');
  log('PR Title: ' + pr.title);
  log('PR Author: ' + pr.user.login);
  if (release) {
    log('PR Release: ' + release.tag_name);
    log('SwG deployed release: ' + self.swgVersion);
    log('AMP deployed release: ' + ampVersion);
  }
}

function log(message) {
  status.innerHTML += message;
  status.innerHTML += '<br/>';
}
function clear() {
  status.innerHTML = '';
}

// Support hash params.
const hash = location.hash;
if (hash) {
  prInput.value = hash.slice(1);
  trackPr();
}
