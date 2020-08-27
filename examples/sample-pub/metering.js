/** Helps demonstrate metering functionality. */
const MeteringDemo = {
  /** Sets up controls for the metering demo. */
  setupControls: () => {
    // Wire up reset button.
    document
      .querySelector('#metering-controls button')
      .addEventListener('click', () => {
        // Forget the existing PPID.
        delete localStorage.meteringStateId;

        // Refresh so a new PPID will be created and used.
        window.location.reload();
      });

    // Show reset button.
    document.body.classList.add('metering');

    // Update nav button to carry over full URL query.
    document.querySelectorAll('header .nav-button').forEach((navButton) => {
      navButton.href = navButton.href.replace(/\?.*/, location.search);
    });
  },

  /** Returns a new Publisher Provided ID (PPID) suitable for demo purposes. */
  createPpid: () => 'ppid' + Math.round(Math.random() * 9999999999999999),

  /** Returns a Publisher Provided ID (PPID) suitable for demo purposes. */
  getPpid: () => {
    if (!localStorage.meteringStateId) {
      localStorage.meteringStateId = MeteringDemo.createPpid();
    }
    console.log('Metering PPID: ' + localStorage.meteringStateId);
    return localStorage.meteringStateId;
  },

  /** Opens the paywall for demo purposes. */
  openPaywall: () => {
    document.documentElement.classList.add('open-paywall');
  },
};
