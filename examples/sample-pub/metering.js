/**
 * Helps demonstrate metering functionality.
 *
 * Publishers shouldn't use these methods in production. Instead, they should
 * define their own JS and backend code to provide the same functionality securely.
 */
const MeteringDemo = {
  /** Publisher name for the metering demo. */
  PUBLISHER_NAME: 'The Local Scenic',

  /** Google Sign-In Client ID for the metering demo. */
  GOOGLE_SIGN_IN_CLIENT_ID:
    '520465458218-e9vp957krfk2r0i4ejeh6aklqm7c25p4.apps.googleusercontent.com',

  /** URL of iframe containing a Google Sign-In button. */
  GOOGLE_SIGN_IN_IFRAME_URL:
    'http://localhost:8000/examples/sample-pub/gsi-iframe',

  /** Sets up controls for the metering demo. */
  setupControls: () => {
    // Wire up buttons.
    document
      .querySelector('#metering-controls .reset-metering-demo')
      .addEventListener('click', MeteringDemo.resetMeteringDemo);

    // Show reset button.
    document.body.classList.add('metering');

    // Update nav button to carry over full URL query.
    document.querySelectorAll('header .nav-button').forEach((navButton) => {
      navButton.href = navButton.href.replace(/\?.*/, location.search);
    });
  },

  /** Resets the metering demo. */
  resetMeteringDemo: () => {
    // Forget the existing PPID.
    delete localStorage.meteringPpid;

    // Forget the existing registration timestamp.
    delete localStorage.meteringRegistrationTimestamp;

    // Delete the existing username.
    delete localStorage.meteringUsername;

    // Sign out of Google Sign-In.
    self.GaaMeteringRegwall.signOut({
      googleSignInClientId: MeteringDemo.GOOGLE_SIGN_IN_CLIENT_ID,
    }).then(() => {
      // Refresh.
      window.location.reload();
    });
  },

  /** Mocks registration of a user, given user credentials. */
  registerUser: (credentials) => {
    // Record the registration timestamp in seconds (not milliseconds).
    localStorage.meteringRegistrationTimestamp = Math.floor(Date.now() / 1000);

    // Record the user's name, for the metering demo.
    localStorage.meteringUsername = credentials.name;
  },

  /** Returns a new Publisher Provided ID (PPID) suitable for demo purposes. */
  createPpid: () => 'ppid' + Math.round(Math.random() * 9999999999999999),

  /** Returns a Publisher Provided ID (PPID) suitable for demo purposes. */
  getPpid: () => {
    if (!localStorage.meteringPpid) {
      localStorage.meteringPpid = MeteringDemo.createPpid();
    }
    console.log('Metering PPID: ' + localStorage.meteringPpid);
    return localStorage.meteringPpid;
  },

  /** Opens the paywall for demo purposes. */
  openPaywall: () => {
    document.documentElement.classList.add('open-paywall');
  },

  /** Returns the user's metering state, including when the user registered. */
  fetchMeteringState: () => {
    // Logs the username, for the metering demo.
    if (localStorage.meteringUsername) {
      console.log(`Hello, ${localStorage.meteringUsername}!`);
    }

    return Promise.resolve({
      id: MeteringDemo.getPpid(),
      registrationTimestamp: localStorage.meteringRegistrationTimestamp,
    });
  },
};
