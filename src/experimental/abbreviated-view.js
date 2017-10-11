import {abbreviatedView} from './subscriptions-ui-util';
import {setImportantStyles} from '../utils/style';

export class AbbreviatedView {
  constructor(win, context, offerContainer, subscriptions) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!Element} */
    this.offerContainer_ = offerContainer;

    /** @private @const {!SubscriptionResponse} */
    this.subscriptions_ = subscriptions;

    /** @private @const {!Element} */
    this.abbreviatedViewElement_ = this.document_.createElement('iframe');

    /** @private @const {function()} */
    this.ref_ = this.boundResizeListener_.bind(this);
  }

  /**
   * Initializes the abbreviated view in the <swg-popup>.
   * @return {!Promise}
   */
  init() {
    return this.buildView_().then(() => this.show());
  }

  /*
   * Shows the offers element within the <swg-popup> element.
   */
  show() {
    this.abbreviatedViewElement_.style.removeProperty('display');
  }

  /*
   * Hides the  offers element within the <swg-popup> element.
   */
  hide() {
    this.abbreviatedViewElement_.style
        .setProperty('display', 'none', 'important');
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.abbreviatedViewElement_;
  }

  /**
   * @param {function()} callback
   * @return {!OffersView}
   */
  onSubscribeClicked(callback) {
    this.subscribeClicked_ = callback;
    return this;
  }

  buildView_() {
    const iframe = this.abbreviatedViewElement_;
    // TODO(dparikh): Polyfill 'srcdoc'.
    // Ref.: https://github.com/ampproject/amphtml/blob/master/src/friendly-iframe-embed.js#L148-L163
    iframe.srcdoc = abbreviatedView(this.subscriptions_);
    iframe.setAttribute('frameborder', 0);
    iframe.setAttribute('scrolling', 'no');

    // It's important to add `onload` callback before appending to DOM, otherwise
    // onload could arrive immediately.
    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    this.offerContainer_.appendChild(iframe);

    return readyPromise.then(() => {

      const subscribeButton = iframe.contentDocument.getElementById(
          'swg-button');

      subscribeButton.onclick = () => {
        this.subscribeClicked_();
      };

      setImportantStyles(iframe, {
        'opacity': 1,
        'border': 'none',
        'width': '100%',
        'background-color': '#fff',
      });

      iframe.contentWindow.addEventListener('resize', this.ref_);
    });
  }

  /**
   * Listens for the iframe content resize to notify the parent container.
   * The event listener is removed after reading the correct height.
   * @param {!Event} event
   * @private
   */
  boundResizeListener_(event) {
    const iframe = this.abbreviatedViewElement_;
    const height = iframe.contentDocument.body.scrollHeight;
    this.context_.resizeView(this, height);
    event.currentTarget.removeEventListener(event.type, this.ref_);
  }
}

