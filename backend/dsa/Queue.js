/**
 * CampusPulse FIFO Queue Module
 * Academic Implementation with Head-Index Pointer to Guarantee O(1) Dequeue Operations.
 * Authoritative Reference: docs/DSA_ARCHITECTURE.md
 */

export class Queue {
  constructor() {
    this.items = [];
    this.head = 0;
  }

  /**
   * Add an element to the rear of the queue
   * Complexity: O(1)
   */
  enqueue(item) {
    if (item === undefined || item === null) {
      throw new TypeError('Cannot enqueue null or undefined item.');
    }
    this.items.push(item);
  }

  /**
   * Remove and return the element from the front of the queue
   * Complexity: O(1) (avoids Array.shift() O(n) re-indexing)
   */
  dequeue() {
    if (this.isEmpty()) {
      return null;
    }
    const item = this.items[this.head];
    this.items[this.head] = null; // Free reference for garbage collection
    this.head++;

    // Periodic memory cleanup when unused head space exceeds 50 items and half the array
    if (this.head > 50 && this.head > this.items.length / 2) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }

    return item;
  }

  /**
   * Inspect the front element without removing it
   * Complexity: O(1)
   */
  peek() {
    return this.isEmpty() ? null : this.items[this.head];
  }

  /**
   * Check whether the queue contains any active elements
   * Complexity: O(1)
   */
  isEmpty() {
    return this.size() === 0;
  }

  /**
   * Return the number of active elements in the queue
   * Complexity: O(1)
   */
  size() {
    return this.items.length - this.head;
  }

  /**
   * Return active elements as an ordered array (from front to rear)
   * Complexity: O(n)
   */
  toArray() {
    return this.items.slice(this.head).filter(item => item !== null);
  }

  /**
   * Clear all elements from the queue
   */
  clear() {
    this.items = [];
    this.head = 0;
  }
}
