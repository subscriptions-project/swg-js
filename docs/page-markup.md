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

## JSON-LD markup

SwG uses Schema.org markup. Using JSON-LD, the markup would look like:

```
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


## Microdata markup

SWG uses schema.org markup. Using Microdata, the mark up could look like this:

```
<div itemscope itemtype="http://schema.org/NewsArticle http://schema.org/Other" id="top">
  <meta itemprop="isAccessibleForFree" content="false"/>
  <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
    <meta itemprop="name" content="New York Times"/>
    <meta itemprop="productID" content="pub1:premium"/>
  </div>
  <div itemprop="articleBody" class="paywalled-section">
    Paid content possibly.
  </div>
  <div itemscope itemtype="http://schema.org/OtherSection" id="bottom">
    <meta itemprop="isAccessibleForFree" content="True"/>
  </div>
</div>
```

The requirements to retreive a usable configuration from embedded microdata are:
 1. Presence of atleast one div marked up as itemscope with itemtype containing 'NewsArticle' in
    schema vocabulary (indicated by URL http://schema.org/)
 2. With presence of such a node as parent, a valid configuration is returned if it
   - contains a meta in one of its childres, with item property "isAccessibleForFree" indicating
     access info that is not broken in itemscope ownership upto the above parent and
   - contains a child itemscope of type containing 'Product' in schema vocabulary and a item
     property 'productID' that is not broken in itemscope ownership upto the above parent

In the example above, the div with id = "bottom" is ignored. The result configuration will be as
follows:
  isAccessibleForFree: false, productID: pub1:premium

For each, the first valid page configuration is used even if there are more configurations that
exist. It is therefore, advised to place the configuration as high up in the DOM tree as possible
sthat represents the accurate information. When DOM is ready, if no access info is found, it is
assumed that access is indeed free.