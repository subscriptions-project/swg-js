import {GaaGoogle3pSignInButton, GaaMeteringRegwall} from '../utils/gaa';

export default {
  title: 'Showcase',
};

export const ThirdPartySignInButton = () => {
  document.body.style.padding = '0';
  return GaaGoogle3pSignInButton.render('https://example.com/login');
};

export const Regwall = () => {
  // Add publisher metadata.
  document.body.insertAdjacentHTML(
    'beforeend',
    `
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "NewsArticle",
  "headline": "16 Top Spots for Hiking",
  "image": "https://scenic-2017.appspot.com/icons/icon-2x.png",
  "datePublished": "2025-02-05T08:00:00+08:00",
  "dateModified": "2025-02-05T09:20:00+08:00",
  "author": {
    "@type": "Person",
    "name": "John Doe"
  },
  "publisher": {
      "name": "The Scenic - USA",
      "@type": "Organization",
      "@id": "scenic-2017.appspot.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://scenic-2017.appspot.com/icons/icon-2x.png"
      }
  },
  "description": "A most wonderful article",
  "isAccessibleForFree": "False",
  "isPartOf": {
    "@type": ["CreativeWork", "Product"],
    "name" : "Scenic News",
    "productID": "scenic-2017.appspot.com:news"
  }
}
</script>
`
  );

  return GaaMeteringRegwall.render({
    iframeUrl:
      '/iframe.html?id=showcase--third-party-sign-in-button&viewMode=story',
  });
};
