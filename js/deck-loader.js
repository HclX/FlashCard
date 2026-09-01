/**
 * DeckLoader
 * Reads domains/manifest.json (a plain list of folder names), then fetches
 * each domain's domain.json (metadata) and cards.json (the actual cards).
 * Every domain is a self-contained folder under /domains/, so adding a new
 * subject is just: add a folder, list it in manifest.json.
 */
const DeckLoader = (() => {
  const DOMAINS_ROOT = 'domains';

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Could not load ${path} (${res.status})`);
    }
    return res.json();
  }

  /** Returns an array of domain metadata objects, each augmented with `folder`. */
  async function listDomains() {
    let manifest;
    try {
      manifest = await fetchJSON(`${DOMAINS_ROOT}/manifest.json`);
    } catch (err) {
      console.error('Failed to load domains/manifest.json', err);
      return [];
    }

    const folders = (manifest.domains || []).filter((f) => f !== '_template');

    const results = await Promise.all(
      folders.map(async (folder) => {
        try {
          const meta = await fetchJSON(`${DOMAINS_ROOT}/${folder}/domain.json`);
          return { ...meta, folder };
        } catch (err) {
          console.error(`Failed to load domain "${folder}"`, err);
          return null;
        }
      })
    );

    return results.filter(Boolean);
  }

  /** Loads the cards for one domain (by folder name), resolving image paths. */
  async function loadCards(domainMeta) {
    const cardsFile = domainMeta.cardsFile || 'cards.json';
    const cards = await fetchJSON(`${DOMAINS_ROOT}/${domainMeta.folder}/${cardsFile}`);

    return cards.map((card) => ({
      ...card,
      image: card.image ? `${DOMAINS_ROOT}/${domainMeta.folder}/${card.image}` : null,
    }));
  }

  return { listDomains, loadCards };
})();
