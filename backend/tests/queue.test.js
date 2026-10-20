import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Queue } from '../dsa/Queue.js';

describe('Academic Queue (FIFO) Unit Tests', () => {
  test('Initializes an empty queue with size 0 and isEmpty true', () => {
    const queue = new Queue();
    assert.equal(queue.size(), 0);
    assert.equal(queue.isEmpty(), true);
    assert.equal(queue.peek(), null);
    assert.equal(queue.dequeue(), null);
  });

  test('Enqueues elements and increments size in O(1)', () => {
    const queue = new Queue();
    queue.enqueue({ userId: 'u1', name: 'Alice' });
    queue.enqueue({ userId: 'u2', name: 'Bob' });
    queue.enqueue({ userId: 'u3', name: 'Charlie' });

    assert.equal(queue.size(), 3);
    assert.equal(queue.isEmpty(), false);
    assert.equal(queue.peek().name, 'Alice');
  });

  test('Dequeues elements in strict FIFO sequence without array re-indexing', () => {
    const queue = new Queue();
    const items = ['First', 'Second', 'Third', 'Fourth'];
    items.forEach(item => queue.enqueue(item));

    assert.equal(queue.dequeue(), 'First');
    assert.equal(queue.size(), 3);
    assert.equal(queue.peek(), 'Second');

    assert.equal(queue.dequeue(), 'Second');
    assert.equal(queue.dequeue(), 'Third');
    assert.equal(queue.dequeue(), 'Fourth');

    assert.equal(queue.isEmpty(), true);
    assert.equal(queue.dequeue(), null);
  });

  test('Rejects null or undefined enqueue operations with TypeError', () => {
    const queue = new Queue();
    assert.throws(() => queue.enqueue(null), TypeError);
    assert.throws(() => queue.enqueue(undefined), TypeError);
  });

  test('Performs periodic memory reclamation when head offset exceeds threshold', () => {
    const queue = new Queue();
    for (let i = 0; i < 100; i++) {
      queue.enqueue(`item_${i}`);
    }
    assert.equal(queue.size(), 100);

    // Dequeue 60 items (exceeds 50 threshold and > half array length)
    for (let i = 0; i < 60; i++) {
      assert.equal(queue.dequeue(), `item_${i}`);
    }

    assert.equal(queue.size(), 40);
    assert.equal(queue.peek(), 'item_60');
    // Verify array compaction occurred from 100 down to 49 items
    assert.ok(queue.items.length < 100);
    assert.equal(queue.head, 9);
  });

  test('toArray() returns remaining active elements from front to rear', () => {
    const queue = new Queue();
    queue.enqueue('A');
    queue.enqueue('B');
    queue.enqueue('C');
    queue.dequeue(); // Drops 'A'

    assert.deepEqual(queue.toArray(), ['B', 'C']);
  });

  test('clear() resets queue state completely', () => {
    const queue = new Queue();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.clear();

    assert.equal(queue.size(), 0);
    assert.equal(queue.isEmpty(), true);
    assert.equal(queue.peek(), null);
  });
});
