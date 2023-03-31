import {
  GaaGoogle3pSignInButton,
  GaaGoogleSignInButton,
  GaaMetering,
  GaaMeteringRegwall,
  GaaSignInWithGoogleButton,
} from '../runtime/extended-access';
import {GoogleUserDef} from '../runtime/extended-access/interfaces';
import {Subscriptions} from '../api/subscriptions';

export {};

declare global {
  interface Window {
    /**
     * The global `SWG` array contains client ready callbacks. Swgjs calls these when its Subscriptions API is ready.
     * https://github.com/subscriptions-project/swg-js/blob/main/docs/embed-client.md#client-ready-callback
     */
    SWG: ((api: Subscriptions) => void)[];

    // Swgjs defines these Extended Access classes globally.
    GaaGoogleSignInButton: GaaGoogleSignInButton;
    GaaGoogle3pSignInButton: GaaGoogle3pSignInButton;
    GaaSignInWithGoogleButton: GaaSignInWithGoogleButton;
    GaaMeteringRegwall: GaaMeteringRegwall;
    GaaMetering: GaaMetering;

    /**
     * Google Sign-In API.
     * https://developers.google.com/identity/sign-in/web/reference
     */
    gapi: {
      load: (library: string, callback: () => void) => void;
      auth2: {
        init: () => void;
        getAuthInstance: () => {
          signOut: () => Promise<void>;
        };
      };
      signin2: {
        render: (
          id: string,
          params: {
            longtitle: boolean;
            onsuccess: (googleUserDef: GoogleUserDef) => void;
            prompt: string;
            scope: string;
            theme: string;
          }
        ) => void;
      };
    };

    /**
     * Sign In With Google API.
     * https://developers.google.com/identity/gsi/web/reference/js-reference
     */
    google: {
      accounts: {
        id: {
          initialize: (params: {
            /* eslint-disable google-camelcase/google-camelcase */
            client_id: string;
            callback: (data: {credential: string}) => void;
            allowed_parent_origin?: string[];
            /* eslint-enable google-camelcase/google-camelcase */
          }) => void;
          renderButton: (
            element: HTMLElement | null,
            params: {
              'type': string;
              'theme': string;
              'text': string;
              'logo_alignment': string;
              'width'?: number;
              'height'?: number;
              'click_listener': () => void;
            }
          ) => void;
        };
      };
    };
  }
}
