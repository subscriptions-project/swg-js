/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

 import * as dom from './dom';


 describes.realWin('Dom', {}, env => {
   let win;
   let doc;

   beforeEach(() => {
     win = env.win;
     doc = win.document;
   });

   describe('Dom', () => {

     it('Creates an element with attributes', () => {
       const attrs = {
         'frameborder': 0,
         'scrolling': 'no',
         'width': '100%',
         'height': '100%',
       };
       const element = dom.createElementWithAttributes(doc, 'iframe', attrs);
       expect(element.getAttribute('frameborder'))
           .to.equal(attrs['frameborder'].toString());
       expect(element.getAttribute('scrolling')).to.equal(attrs['scrolling']);
       expect(element.getAttribute('width')).to.equal(attrs['width']);
       expect(element.getAttribute('height')).to.equal(attrs['height']);
       expect(element.getAttribute('border')).to.equal(null);
       expect(element.getAttribute('class')).to.equal(null);
       expect(element.getAttribute('style')).to.equal(null);
     });

     it('Creates an element with no attributes', () => {
       const element = dom.createElementWithAttributes(doc, 'iframe', {});
       expect(element.getAttribute('frameborder')).to.equal(null);
       expect(element.getAttribute('scrolling')).to.equal(null);
       expect(element.getAttribute('border')).to.equal(null);
     });
   });
 });
