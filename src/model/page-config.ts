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

export class PageConfig {
  publicationId_: string;
  productId_: string | null;
  label_: string | null;
  locked_: boolean;

  constructor(productOrPublicationId: string, locked: boolean) {
    let publicationId, productId, label;
    const div = productOrPublicationId.indexOf(':');
    if (div != -1) {
      // The argument is a product id.
      productId = productOrPublicationId;
      publicationId = productId.substring(0, div);
      label = productId.substring(div + 1);
    } else {
      // The argument is a publication id.
      publicationId = productOrPublicationId;
      productId = null;
      label = null;
    }

    this.publicationId_ = publicationId;
    this.productId_ = productId;
    this.label_ = label;
    this.locked_ = locked;
  }

  getPublicationId(): string {
    return this.publicationId_;
  }

  getProductId(): string | null {
    return this.productId_;
  }

  getLabel(): string | null {
    return this.label_;
  }

  isLocked(): boolean {
    return this.locked_;
  }
}
