// Synthetic existing implementation for this example. No production site code.
const normalize = text => text.normalize('NFKC').toLowerCase();

export function searchEntries(entries, query, { category = 'all' } = {}) {
  const word = normalize(query);
  return entries.filter(entry => [entry.title, ...entry.tags].some(field => normalize(field).includes(word)));
}
