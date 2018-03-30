/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

import {Dialog} from './dialog';
import {DialogManager} from './dialog-manager';
import {GlobalDoc} from '../model/doc';


describes.realWin('DialogManager', {}, env => {
  let clock;
  let win;
  let dialogManager;
  let dialogIfc;
  let currentView;
  let initView;
  let graypaneStubs;

  beforeEach(() => {
    clock = sandbox.useFakeTimers();
    win = env.win;
    dialogManager = new DialogManager(new GlobalDoc(win));
    currentView = null;
    initView = {
      whenComplete: function() {
        return Promise.resolve(true);
      },
    };
    dialogIfc = {
      open: sandbox.stub(Dialog.prototype, 'open', function() {
        return Promise.resolve(this);
      }),
      close: sandbox.stub(Dialog.prototype, 'close', function() {}),
      openView: sandbox.stub(Dialog.prototype, 'openView', function(view) {
        currentView = view;
        return Promise.resolve();
      }),
      getCurrentView: sandbox.stub(Dialog.prototype, 'getCurrentView',
          () => currentView),
    };
    let graypaneAttached;
    const graypane = dialogManager.popupGraypane_;
    graypaneStubs = {
      isAttached: sandbox.stub(graypane, 'isAttached', () => graypaneAttached),
      attach: sandbox.stub(graypane, 'attach', () => {
        graypaneAttached = true;
      }),
      destroy: sandbox.stub(graypane, 'destroy', () => {
        graypaneAttached = false;
      }),
      show: sandbox.stub(graypane, 'show'),
      hide: sandbox.stub(graypane, 'hide'),
    };
  });

  it('should open dialog for the first time', () => {
    expect(dialogManager.dialog_).to.be.null;
    return dialogManager.openDialog().then(dialog => {
      expect(dialog).to.exist;
      expect(dialogManager.dialog_).to.equal(dialog);
      expect(dialogIfc.open).to.be.calledOnce;
    });
  });

  it('should re-open the same dialog', () => {
    return dialogManager.openDialog().then(dialog1 => {
      // Repeat.
      return dialogManager.openDialog().then(dialog2 => {
        expect(dialog2).to.equal(dialog1);
        // `Dialog.open` is only called once.
        expect(dialogIfc.open).to.be.calledOnce;
      });
    });
  });

  it('should open view', () => {
    return dialogManager.openView(initView).then(() => {
      expect(dialogIfc.open).to.be.calledOnce;
      expect(dialogIfc.openView).to.be.calledOnce;
      expect(dialogIfc.openView).to.be.calledWith(initView);
    });
  });

  it('should complete view and close dialog', () => {
    return dialogManager.openView(initView).then(() => {
      expect(currentView).to.equal(initView);
      dialogManager.completeView(initView);
      expect(dialogIfc.close).to.not.be.called;
      expect(dialogManager.dialog_).to.exist;
      clock.tick(10);
      expect(dialogIfc.close).to.not.be.called;
      expect(dialogManager.dialog_).to.exist;
      clock.tick(100);
      expect(dialogIfc.close).to.be.calledOnce;
      expect(dialogManager.dialog_).to.not.exist;
    });
  });

  it('should complete all and close dialog', () => {
    return dialogManager.openView(initView).then(() => {
      dialogManager.completeAll();
      expect(dialogIfc.close).to.be.calledOnce;
      expect(dialogManager.dialog_).to.not.exist;
      expect(graypaneStubs.destroy).to.not.be.called;
    });
  });

  it('should complete view and continue dialog', () => {
    const view2 = Object.assign({}, initView);
    return dialogManager.openView(initView).then(() => {
      expect(currentView).to.equal(initView);
      dialogManager.completeView(initView);
      clock.tick(10);
      expect(dialogIfc.close).to.not.be.called;
      expect(dialogManager.dialog_).to.exist;
      const oldDialog = dialogManager.dialog_;
      // New open view.
      return dialogManager.openView(view2).then(() => {
        clock.tick(100);
        expect(dialogIfc.close).to.not.be.called;
        expect(dialogManager.dialog_).to.equal(oldDialog);
        expect(dialogIfc.open).to.be.calledOnce;
      });
    });
  });

  it('should ignore close for the different view', () => {
    const view2 = Object.assign({}, initView);
    return dialogManager.openView(initView).then(() => {
      expect(currentView).to.equal(initView);
      dialogManager.completeView(view2);
      clock.tick(110);
      expect(dialogIfc.close).to.not.be.called;
      expect(dialogManager.dialog_).to.exist;
    });
  });

  it('should complete view and reopen dialog', () => {
    const view2 = Object.assign({}, initView);
    return dialogManager.openView(initView).then(() => {
      expect(currentView).to.equal(initView);
      dialogManager.completeView(initView);
      const oldDialog = dialogManager.dialog_;
      clock.tick(110);
      expect(dialogIfc.close).to.be.calledOnce;
      expect(dialogManager.dialog_).to.not.exist;
      // New open view.
      return dialogManager.openView(view2).then(() => {
        clock.tick(100);
        expect(dialogManager.dialog_).to.exist;
        expect(dialogManager.dialog_).to.not.equal(oldDialog);
        expect(dialogIfc.open).to.be.calledTwice;
      });
    });
  });

  it('should open graypane w/o popup window', () => {
    dialogManager.popupOpened();
    expect(graypaneStubs.isAttached()).to.be.true;
    expect(graypaneStubs.show).to.be.calledOnce;
  });

  it('should open graypane w/popup window and handle click', () => {
    const popup = {
      focus: sandbox.spy(),
    };
    dialogManager.popupOpened(popup);
    expect(graypaneStubs.isAttached()).to.be.true;
    expect(graypaneStubs.show).to.be.calledOnce;
    dialogManager.popupGraypane_.getElement().click();
    expect(popup.focus).to.be.calledOnce;
  });

  it('should close graypane', () => {
    dialogManager.popupOpened();
    expect(graypaneStubs.isAttached()).to.be.true;
    dialogManager.popupClosed();
    expect(graypaneStubs.hide).to.be.calledOnce;
  });

  it('should complete all and close graypane when attached', () => {
    dialogManager.popupOpened();
    dialogManager.completeAll();
    expect(graypaneStubs.destroy).to.be.calledOnce;
  });
});
