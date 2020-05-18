<!---
Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS-IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Subscriptions Page Markup

SwG requires configuring two main properties:
 1. The product ID that the user must be granted to view the content.
 2. Whether this content requires this product at this time.

SwG uses Schema.org markup. The JSON-LD and Microdata formats are supported.

## JSON-LD markup

Using JSON-LD, the markup would look like:

```html
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "NewsArticle",
  "isAccessibleForFree": false,
  "publisher": {
    "@type": "Organization",
    "name": "The Norcal Tribune"
  },
  "hasPart": {...},
  "isPartOf": {
    "@type": ["CreativeWork", "Product"],
    "name" : "The Norcal Tribune",
    "productID": "norcal_tribune.com:basic"
  }
}
</script>
```

Thus, notice that:
 1. The product ID is "norcal_tribune.com:basic" (`"productID": "norcal_tribune.com:basic"`).
 2. This document is currently locked (`"isAccessibleForFree": false`)
 3. isPartOf["@types"] must include "Product". It also must include "CreativeWork" or one of the following more specific types of CreativeWork: 
    - Article
    - NewsArticle
    - Blog
    - Comment
    - Course
    - HowTo
    - Message
    - Review

## Microdata markup

Using Microdata, the markup could look like this:

```html
<div itemscope itemtype="http://schema.org/NewsArticle">
  <meta itemprop="isAccessibleForFree" content="false"/>
  <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
    <meta itemprop="name" content="The Norcal Tribune"/>
    <meta itemprop="productID" content="norcal_tribune.com:basic"/>
  </div>
</div>
```

A usable configuration will provide `NewsArticle` typed item with `isAccessibleForFree` property and a
subitem of type `Product` that specifies the `productID`.

In this example:
 1. The product ID is "norcal_tribune.com:basic" (`"productID": "norcal_tribune.com:basic"`).
 2. This document is currently locked (`"isAccessibleForFree": false`)

The configuration is resolved as soon as `productID` and `isAccessibleForFree` are found. It is, therefore,
advised to place the configuration as high up in the DOM tree as possible.
