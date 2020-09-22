/**
 * Helps demonstrate metering functionality.
 *
 * Publishers shouldn't use these methods in production. Instead, they should
 * define their own JS and backend code to provide the same functionality securely.
 */
const MeteringDemo = {
  /** Google Sign-In Client ID for the metering demo. */
  GOOGLE_SIGN_IN_CLIENT_ID:
    '520465458218-e9vp957krfk2r0i4ejeh6aklqm7c25p4.apps.googleusercontent.com',

  /** Sets up controls for the metering demo. */
  setupControls: () => {
    // Wire up buttons.
    document
      .querySelector('#metering-controls .reset-metering-demo')
      .addEventListener('click', MeteringDemo.resetMeteringDemo);
    document
      .querySelector('#metering-controls .mock-gsi-completion')
      .addEventListener('click', MeteringDemo.mockGsiCompletion);

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

    // Sign out of Google Sign-In.
    self.GaaMeteringRegwall.signOut({
      googleSignInClientId: MeteringDemo.GOOGLE_SIGN_IN_CLIENT_ID,
    }).then(() => {
      // Refresh.
      window.location.reload();
    });
  },

  /** Mocks the user completing GSI via the Regwall. */
  mockGsiCompletion: () => {
    MeteringDemo.setRegistrationCookie();

    // Refresh.
    window.location.reload();
  },

  /** Sets a registration cookie for the user. */
  setRegistrationCookie: () => {
    // Record the registration timestamp in seconds (not milliseconds).
    localStorage.meteringRegistrationTimestamp = Math.floor(Date.now() / 1000);
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
    return Promise.resolve({
      id: MeteringDemo.getPpid(),
      registrationTimestamp: localStorage.meteringRegistrationTimestamp,
    });
  },
};
