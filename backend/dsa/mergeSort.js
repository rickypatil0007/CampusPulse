/**
 * CampusPulse Stable Merge Sort Module
 * Guarantees O(n log n) Time Complexity across all input distributions.
 * Authoritative Reference: docs/DSA_ARCHITECTURE.md
 */

/**
 * Generic Stable Merge Sort
 * @template T
 * @param {T[]} array - Array to be sorted
 * @param {(a: T, b: T) => number} comparator - Comparator function
 * @returns {T[]} A new sorted array (immutable)
 */
export function mergeSort(array, comparator) {
  if (!Array.isArray(array)) {
    throw new TypeError('First argument must be an array.');
  }
  if (typeof comparator !== 'function') {
    throw new TypeError('Comparator must be a function.');
  }
  if (array.length <= 1) {
    return array.slice();
  }

  const mid = Math.floor(array.length / 2);
  const left = mergeSort(array.slice(0, mid), comparator);
  const right = mergeSort(array.slice(mid), comparator);

  return merge(left, right, comparator);
}

/**
 * Stable merging of two sorted sub-arrays
 */
function merge(left, right, comparator) {
  const result = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    // Note: '<=' preserves stability for equal elements
    if (comparator(left[i], right[j]) <= 0) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }

  while (i < left.length) {
    result.push(left[i]);
    i++;
  }
  while (j < right.length) {
    result.push(right[j]);
    j++;
  }

  return result;
}

/**
 * Reusable comparators for CampusPulse
 */
export const Comparators = {
  byDateAscending: (a, b) => new Date(a.starts_at) - new Date(b.starts_at),
  byDateDescending: (a, b) => new Date(b.starts_at) - new Date(a.starts_at),
  byTitleAscending: (a, b) => (a.title || '').localeCompare(b.title || ''),
  byRemainingSeats: (a, b) => {
    const seatsA = (a.capacity || 0) - (a.confirmed_count || 0);
    const seatsB = (b.capacity || 0) - (b.confirmed_count || 0);
    return seatsB - seatsA; // Most remaining seats first
  },
  byPopularity: (a, b) => (b.confirmed_count || 0) - (a.confirmed_count || 0),
  byQueueNumber: (a, b) => (a.waitlist_number || 0) - (b.waitlist_number || 0),
  byParticipantName: (a, b) => (a.full_name || '').localeCompare(b.full_name || '')
};
