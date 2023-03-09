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

export class UserData {
  id: string;
  email: string;
  emailVerified: string;
  name: string;
  givenName: string;
  familyName: string;
  pictureUrl: string;

  constructor(
    public readonly idToken: string,
    public readonly data: {[key: string]: string}
  ) {
    this.idToken = idToken;
    this.data = data;

    this.id = data['sub'];
    this.email = data['email'];
    this.emailVerified = data['email_verified'];
    this.name = data['name'];
    this.givenName = data['given_name'];
    this.familyName = data['family_name'];
    this.pictureUrl = data['picture'];
  }

  clone(): UserData {
    return new UserData(this.idToken, this.data);
  }

  json() {
    return {
      'id': this.id,
      'email': this.email,
      'emailVerified': this.emailVerified,
      'name': this.name,
      'givenName': this.givenName,
      'familyName': this.familyName,
      'pictureUrl': this.pictureUrl,
    };
  }
}
