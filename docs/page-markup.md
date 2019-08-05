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

# SwG Structured Data Markup

SwG uses [schema.org](https://schema.org) structured data markup for content authorization purposes.  SwG markup specifies a `productID` associated with a content page, and if the user must have entitlement to the `productID` to view the content.

## SwG markup requirements

Type must include [`CreativeWork`](https://schema.org/CreativeWork) or one of the following more specific types of `CreativeWork`:
 - [`Article`](https://schema.org/Article)
 - [`NewsArticle`](https://schema.org/NewsArticle)
 - [`Blog`](https://schema.org/Blog)
 - [`Comment`](https://schema.org/Comment)
 - [`Course`](https://schema.org/Course)
 - [`HowTo`](https://schema.org/HowTo)
 - [`Message`](https://schema.org/Message)
 - [`Review`](https://schema.org/Review)
 - [`WebPage`](https://schema.org/WebPage)

Multiple types can be used.  See the type value for [`isPartOf`](https://schema.org/isPartOf) in the examples below.

[`isAccessibleForFree`](https://schema.org/isAccessibleForFree) must be specified.  Use `true` to indicate content is available for free.

`isPartOf` must be specified and include:
 - the [`name`](https://schema.org/name) of the publication, and
 - the `productID` associated with the content page.

Media objects on a content page must be marked as [`associatedMedia`](https://schema.org/associatedMedia).

## Markup placement
The SwG configuration is resolved as soon as `productID` and `isAccessibleForFree` are found. It is, therefore, advised to place structured data markup as high in the DOM tree as possible.

## Supported formats

JSON-LD and Microdata formats are supported; JSON-LD is preferred.

## JSON-LD markup

Using JSON-LD, the markup for a publication `The Norcal Tribune` with a productID `norcal_tribune.com:basic` could look like:

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

## Microdata markup

The corresponding markup in Microdata format could look like:

```html
<div itemscope itemtype="http://schema.org/NewsArticle">
  <meta itemprop="isAccessibleForFree" content="false"/>
  <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
    <meta itemprop="name" content="The Norcal Tribune"/>
    <meta itemprop="productID" content="norcal_tribune.com:basic"/>
  </div>
</div>
```
