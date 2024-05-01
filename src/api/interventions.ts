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

import {AudienceActionIframeFlow} from '../runtime/audience-action-flow';
import {Deps} from '../runtime/deps';

export interface InterventionComplete {
    configurationId?: string;
    actionCompleted?: boolean;
    alreadyCompleted?: boolean;
    email?: string;
    displayName?: string;
    givenName?: string;
    familyName?: string;
}

export interface ShowInterventionParams {
    /** Determine whether the view is closable. */
    isClosable?: boolean;

    /**
     * TODO: mhkawano - come up with new doc
     */
    onResult?: (result: {}) => Promise<boolean> | boolean;

    /**
     * TODO: mhkawano - come up with new doc
     */
    onComplete?: (result: InterventionComplete) => Promise<void>;
}
  
export interface Intervention {
    readonly type: string;
    readonly configurationId?: string;
    readonly preference?: string;
}

export class AvailableIntervention implements Intervention {
    readonly type: string;
    readonly configurationId?: string;
    readonly preference?: string;

    constructor(original: Intervention, private readonly deps_: Deps) {
        this.type = original.type;
        this.configurationId = original.configurationId;
        this.preference = original.preference;
    }

    /**
     * Starts the intervention flow.
     */
    show(params: ShowInterventionParams): Promise<void> {
        const flow = new AudienceActionIframeFlow(this.deps_, {
            isClosable: params.isClosable,
            action: this.type,
            configurationId: this.configurationId,
            onResult: params.onResult,
            onComplete: params.onComplete,
        });
        return flow.start();
    }
}
