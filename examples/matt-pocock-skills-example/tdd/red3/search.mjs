// Synthetic existing implementation for this example. No production site code.
const normalize = text => text.normalize('NFKC').toLowerCase();

export function searchEntries(entries, query, { category = 'all' } = {}) {
  const words = normalize(query).split(/\s+/);
  return entries.filter(entry => words.every(word => [entry.title, ...entry.tags].some(field => normalize(field).includes(word))));
}
