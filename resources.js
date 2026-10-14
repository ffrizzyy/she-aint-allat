// Support resources by region (FR-15). Data only, no DOM.
// SAF-06: the clinical advisor must review every entry before each minor release. Numbers change, so the page tells people to check the site.
// Every url must be on the never-intercept list in matcher.js (support.test.js enforces it).
(function () {
  const regions = {
    ID: [
      { name: 'Layanan darurat 112', kind: 'emergency', tel: '112' },
      { name: 'Into The Light Indonesia', kind: 'directory', url: 'https://www.intothelightid.org' }
    ],
    US: [
      { name: '988 Suicide & Crisis Lifeline', kind: 'crisis', tel: '988', url: 'https://988lifeline.org' },
      { name: '911', kind: 'emergency', tel: '911' }
    ],
    UK: [
      { name: 'Samaritans 116 123', kind: 'crisis', tel: '116123', url: 'https://www.samaritans.org' },
      { name: '999', kind: 'emergency', tel: '999' }
    ],
    GLOBAL: [
      { name: 'Find a Helpline', kind: 'directory', url: 'https://findahelpline.com' },
      { name: 'Befrienders Worldwide', kind: 'directory', url: 'https://www.befrienders.org' },
      { name: 'IASP crisis centres', kind: 'directory', url: 'https://www.iasp.info' }
    ]
  };
  const api = { regions, order: ['ID', 'US', 'UK', 'GLOBAL'] };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.SAA = Object.assign(globalThis.SAA || {}, { resources: api });
})();
