import {GaaGoogle3pSignInButton} from '../utils/gaa';

export default {
  title: 'Showcase',
};

export const ThirdPartySignInButton = () =>
  GaaGoogle3pSignInButton.render('https://example.com/login');
