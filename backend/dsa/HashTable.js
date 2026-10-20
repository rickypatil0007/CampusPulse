/**
 * CampusPulse Custom Hash Table Module
 * Implements Polynomial Rolling Hash with Separate Chaining for Duplicate Detection.
 * Authoritative Reference: docs/DSA_ARCHITECTURE.md
 */

export class HashTable {
  constructor(capacity = 64) {
    this.capacity = capacity;
    this.buckets = new Array(capacity).fill(null).map(() => []);
    this.count = 0;
  }

  /**
   * Deterministic polynomial rolling hash function for string keys
   * Hash(S) = (sum(S[i] * 31^(k - 1 - i))) mod capacity
   */
  _hash(key) {
    let hash = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % this.capacity;
    }
    return Math.abs(hash);
  }

  /**
   * Insert or update a key-value pair
   * Average Complexity: O(1) | Worst-Case: O(n)
   */
  set(key, value) {
    if (key === undefined || key === null) {
      throw new TypeError('Key cannot be null or undefined.');
    }
    const index = this._hash(key);
    const bucket = this.buckets[index];

    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket[i][1] = value; // Update existing key
        return;
      }
    }

    bucket.push([key, value]);
    this.count++;

    // Dynamic resize when load factor exceeds 0.75
    if (this.count / this.capacity > 0.75) {
      this._resize(this.capacity * 2);
    }
  }

  /**
   * Retrieve value associated with a key
   * Average Complexity: O(1) | Worst-Case: O(n)
   */
  get(key) {
    if (key === undefined || key === null) return undefined;
    const index = this._hash(key);
    const bucket = this.buckets[index];

    for (const [k, v] of bucket) {
      if (k === key) return v;
    }
    return undefined;
  }

  /**
   * Check whether a key exists in the hash table
   * Complexity: O(1)
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Remove a key-value pair from the hash table
   * Complexity: O(1)
   */
  delete(key) {
    if (key === undefined || key === null) return false;
    const index = this._hash(key);
    const bucket = this.buckets[index];

    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket.splice(i, 1);
        this.count--;
        return true;
      }
    }
    return false;
  }

  /**
   * Return total count of stored key-value pairs
   */
  size() {
    return this.count;
  }

  /**
   * Empty all buckets
   */
  clear() {
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.count = 0;
  }

  /**
   * Inspection helper for the DSA Laboratory
   * Returns bucket distributions and chain lengths
   */
  getBucketInspection() {
    return this.buckets.map((bucket, index) => ({
      bucketIndex: index,
      chainLength: bucket.length,
      entries: bucket.map(([k, v]) => ({ key: k, value: v }))
    }));
  }

  _resize(newCapacity) {
    const oldBuckets = this.buckets;
    this.capacity = newCapacity;
    this.buckets = new Array(newCapacity).fill(null).map(() => []);
    this.count = 0;

    for (const bucket of oldBuckets) {
      for (const [k, v] of bucket) {
        this.set(k, v);
      }
    }
  }
}
