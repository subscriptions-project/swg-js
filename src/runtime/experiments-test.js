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

import {
  isExperimentOn,
  setExperiment,
  setExperimentsStringForTesting,
} from './experiments';


describes.realWin('experiments', {}, env => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  afterEach(() => {
    setExperimentsStringForTesting('');
  });

  it('should default experiments to "off"', () => {
    expect(isExperimentOn(win, 'experiment-A')).to.be.false;
    expect(isExperimentOn(win, 'experiment-B')).to.be.false;
  });

  it('should parse a single experiment', () => {
    setExperimentsStringForTesting('experiment-A');
    expect(isExperimentOn(win, 'experiment-A')).to.be.true;
    expect(isExperimentOn(win, 'experiment-B')).to.be.false;
  });

  it('should parse a set of experiments', () => {
    setExperimentsStringForTesting('experiment-A,experiment-B,');
    expect(isExperimentOn(win, 'experiment-A')).to.be.true;
    expect(isExperimentOn(win, 'experiment-B')).to.be.true;
  });

  it('should update an experiment', () => {
    setExperimentsStringForTesting('experiment-A,experiment-B,');
    setExperiment(win, 'experiment-C', true);
    setExperiment(win, 'experiment-A', false);
    expect(isExperimentOn(win, 'experiment-A')).to.be.false;
    expect(isExperimentOn(win, 'experiment-B')).to.be.true;
    expect(isExperimentOn(win, 'experiment-C')).to.be.true;
  });

  it('should parse duplicate experiments', () => {
    setExperimentsStringForTesting('experiment-A,experiment-A,');
    expect(isExperimentOn(win, 'experiment-A')).to.be.true;
    setExperiment(win, 'experiment-A', false);
    expect(isExperimentOn(win, 'experiment-A')).to.be.false;
  });
});
