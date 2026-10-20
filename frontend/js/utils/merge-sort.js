/**
 * CampusPulse Client-Side Stable Merge Sort
 * Re-orders event cards and participant rosters without server round-trips.
 */

export function mergeSort(array, comparator) {
  if (!Array.isArray(array)) return [];
  if (typeof comparator !== 'function') return array.slice();
  if (array.length <= 1) return array.slice();

  const mid = Math.floor(array.length / 2);
  const left = mergeSort(array.slice(0, mid), comparator);
  const right = mergeSort(array.slice(mid), comparator);

  return merge(left, right, comparator);
}

function merge(left, right, comparator) {
  const result = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (comparator(left[i], right[j]) <= 0) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }

  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);

  return result;
}

export const Comparators = {
  byDateAscending: (a, b) => new Date(a.starts_at) - new Date(b.starts_at),
  byDateDescending: (a, b) => new Date(b.starts_at) - new Date(a.starts_at),
  byTitleAscending: (a, b) => (a.title || '').localeCompare(b.title || ''),
  byRemainingSeats: (a, b) => {
    const seatsA = (a.capacity || 0) - (a.confirmed_count || 0);
    const seatsB = (b.capacity || 0) - (b.confirmed_count || 0);
    return seatsB - seatsA;
  },
  byPopularity: (a, b) => (b.confirmed_count || 0) - (a.confirmed_count || 0),
  byQueueNumber: (a, b) => (a.waitlist_number || 0) - (b.waitlist_number || 0),
  byParticipantName: (a, b) => (a.full_name || '').localeCompare(b.full_name || '')
};
