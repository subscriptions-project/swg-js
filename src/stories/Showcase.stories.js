import {GaaGoogle3pSignInButton} from '../utils/gaa';

export default {
  title: 'Showcase',
};

export const Google3pSignInButton = () =>
  GaaGoogle3pSignInButton.render('https://www.google.com/');
