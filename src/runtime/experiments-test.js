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

import {ErrorUtils} from '../utils/errors';
import {
  getOnExperiments,
  isExperimentOn,
  setExperiment,
  setExperimentsStringForTesting,
} from './experiments';

describes.realWin('experiments', {}, (env) => {
  let win;
  let sessionStorageMock;
  let errorCount, throwAsyncStub;
  let randomResults, randomCall;

  beforeEach(() => {
    win = env.win;
    const sessionStorage = {
      getItem: () => null,
      setItem: () => {},
    };
    sessionStorageMock = sandbox.mock(sessionStorage);
    Object.defineProperty(win, 'sessionStorage', {value: sessionStorage});
    errorCount = 0;
    throwAsyncStub = sandbox.stub(ErrorUtils, 'throwAsync').callsFake(() => {});
    randomResults = [];
    randomCall = 0;
    sandbox.stub(win.Math, 'random').callsFake(() => {
      if (randomCall >= randomResults.length) {
        throw new Error('random not allowed');
      }
      return randomResults[randomCall++];
    });
  });

  afterEach(() => {
    setExperimentsStringForTesting('');
    sessionStorageMock.verify();
    if (throwAsyncStub.callCount == 0) {
      expect(errorCount).to.equal(0);
    } else {
      expect(errorCount).to.equal(
        throwAsyncStub.callCount,
        'ERROR:' + throwAsyncStub.args[0][0]
      );
    }
  });

  describe('simple on/off', () => {
    beforeEach(() => {
      sessionStorageMock.expects('getItem').never();
      sessionStorageMock.expects('setItem').never();
    });

    it('should default experiments to "off"', () => {
      setExperimentsStringForTesting('');
      expect(isExperimentOn(win, 'experiment-A')).to.be.false;
      expect(isExperimentOn(win, 'experiment-B')).to.be.false;
      expect(getOnExperiments(win)).to.deep.equal([]);
    });

    it('should parse a single experiment', () => {
      setExperimentsStringForTesting('experiment-A');
      expect(isExperimentOn(win, 'experiment-A')).to.be.true;
      expect(isExperimentOn(win, 'experiment-B')).to.be.false;
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });

    it('should parse a set of experiments', () => {
      setExperimentsStringForTesting('experiment-A,experiment-B,');
      expect(isExperimentOn(win, 'experiment-A')).to.be.true;
      expect(isExperimentOn(win, 'experiment-B')).to.be.true;
      expect(getOnExperiments(win)).to.deep.equal([
        'experiment-A',
        'experiment-B',
      ]);
    });

    it('should update an experiment', () => {
      setExperimentsStringForTesting('experiment-A,experiment-B,');
      setExperiment(win, 'experiment-C', true);
      setExperiment(win, 'experiment-A', false);
      expect(isExperimentOn(win, 'experiment-A')).to.be.false;
      expect(isExperimentOn(win, 'experiment-B')).to.be.true;
      expect(isExperimentOn(win, 'experiment-C')).to.be.true;
      expect(getOnExperiments(win)).to.deep.equal([
        'experiment-B',
        'experiment-C',
      ]);
    });

    it('should parse duplicate experiments', () => {
      setExperimentsStringForTesting('experiment-A,experiment-A,');
      expect(isExperimentOn(win, 'experiment-A')).to.be.true;
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
      setExperiment(win, 'experiment-A', false);
      expect(isExperimentOn(win, 'experiment-A')).to.be.false;
      expect(getOnExperiments(win)).to.deep.equal([]);
    });

    it('should parse a single experiment as "on"', () => {
      setExperimentsStringForTesting('experiment-A:100,experiment-B:0');
      expect(isExperimentOn(win, 'experiment-A')).to.be.true;
      expect(isExperimentOn(win, 'experiment-B')).to.be.false;
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });

    it('should parse a single experiment as "off"', () => {
      setExperimentsStringForTesting('experiment-A:0,experiment-B');
      expect(isExperimentOn(win, 'experiment-A')).to.be.false;
      expect(isExperimentOn(win, 'experiment-B')).to.be.true;
      expect(getOnExperiments(win)).to.deep.equal(['experiment-B']);
    });

    it('should set experiments in hash', () => {
      setExperimentsStringForTesting('');
      win = {
        location: {
          hash:
            '#swg.experiments=' +
            encodeURIComponent('experiment-A,experiment-B'),
        },
      };
      expect(getOnExperiments(win)).to.deep.equal([
        'experiment-A',
        'experiment-B',
      ]);
    });

    it('should override experiments in hash', () => {
      setExperimentsStringForTesting('experiment-A:100');
      win = {
        location: {
          hash:
            '#swg.experiments=' +
            encodeURIComponent('experiment-A:0,experiment-B'),
        },
      };
      expect(getOnExperiments(win)).to.deep.equal(['experiment-B']);
    });

    it('should tolerate broken hash', () => {
      errorCount = 1;
      setExperimentsStringForTesting('experiment-A');
      win = {location: {}};
      Object.defineProperty(win.location, 'hash', {
        get: () => {
          throw new Error('intentional');
        },
      });
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });

    it('should tolerate whitespace', () => {
      setExperimentsStringForTesting(
        ' experiment-A : 100 ,, experiment-B : 0 '
      );
      expect(isExperimentOn(win, 'experiment-A')).to.be.true;
      expect(isExperimentOn(win, 'experiment-B')).to.be.false;
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });
  });

  describe('fractional experiments', () => {
    it('should select a non-control experiment', () => {
      setExperimentsStringForTesting('experiment-A:1');
      randomResults = [0.01];
      sessionStorageMock
        .expects('setItem')
        .withExactArgs('subscribe.google.com:e:experiment-A:1', 'e')
        .once();
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });

    it('should unselect a non-control experiment', () => {
      setExperimentsStringForTesting('experiment-A:1');
      randomResults = [0.011];
      sessionStorageMock.expects('setItem').never();
      expect(getOnExperiments(win)).to.deep.equal([]);
    });

    it('should select an experiment', () => {
      setExperimentsStringForTesting('experiment-A:1c');
      randomResults = [0.02, 0.5];
      sessionStorageMock
        .expects('setItem')
        .withExactArgs('subscribe.google.com:e:experiment-A:1c', 'e')
        .once();
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });

    it('should unselect a control', () => {
      setExperimentsStringForTesting('experiment-A:1c');
      randomResults = [0.02, 0.51];
      sessionStorageMock
        .expects('setItem')
        .withExactArgs('subscribe.google.com:e:experiment-A:1c', 'c')
        .once();
      expect(getOnExperiments(win)).to.deep.equal(['c-experiment-A']);
    });

    it('should unselect an experiment', () => {
      setExperimentsStringForTesting('experiment-A:1c');
      randomResults = [0.021];
      sessionStorageMock.expects('setItem').never();
      expect(getOnExperiments(win)).to.deep.equal([]);
    });

    it('should NOT select an experiment w/o storage', () => {
      setExperimentsStringForTesting('experiment-A:1');
      Object.defineProperty(win, 'sessionStorage', {value: null});
      sessionStorageMock.expects('setItem').never();
      expect(getOnExperiments(win)).to.deep.equal([]);
    });

    it('should tolerate storage failure on read', () => {
      setExperimentsStringForTesting('experiment-A:1');
      errorCount = 1;
      sessionStorageMock
        .expects('getItem')
        .throws(new Error('intentional'))
        .once();
      sessionStorageMock.expects('setItem').never();
      expect(getOnExperiments(win)).to.deep.equal([]);
    });

    it('should tolerate storage failure on write', () => {
      setExperimentsStringForTesting('experiment-A:1');
      randomResults = [0.01];
      errorCount = 1;
      sessionStorageMock
        .expects('setItem')
        .throws(new Error('intentional'))
        .once();
      expect(getOnExperiments(win)).to.deep.equal([]);
    });

    it('should disable control when fraction is too high', () => {
      setExperimentsStringForTesting('experiment-A:40c');
      randomResults = [0.02];
      sessionStorageMock
        .expects('setItem')
        .withExactArgs('subscribe.google.com:e:experiment-A:40', 'e')
        .once();
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });

    it('should select a persisted experiment', () => {
      setExperimentsStringForTesting('experiment-A:1');
      sessionStorageMock
        .expects('getItem')
        .withExactArgs('subscribe.google.com:e:experiment-A:1')
        .returns('e')
        .once();
      sessionStorageMock.expects('setItem').never();
      expect(getOnExperiments(win)).to.deep.equal(['experiment-A']);
    });

    it('should select a persisted control', () => {
      setExperimentsStringForTesting('experiment-A:1');
      sessionStorageMock
        .expects('getItem')
        .withExactArgs('subscribe.google.com:e:experiment-A:1')
        .returns('c')
        .once();
      sessionStorageMock.expects('setItem').never();
      expect(getOnExperiments(win)).to.deep.equal(['c-experiment-A']);
    });

    it('should tolerate an invalid fraction', () => {
      errorCount = 1;
      setExperimentsStringForTesting('experiment-A:NaN');
      sessionStorageMock.expects('getItem').never();
      sessionStorageMock.expects('setItem').never();
      expect(getOnExperiments(win)).to.deep.equal([]);
    });
  });
});
