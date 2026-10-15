// Synthetic existing implementation for this example. No production site code.
export function searchEntries(entries, query, { category = 'all' } = {}) {
  return entries.filter(entry => entry.title.includes(query));
}
