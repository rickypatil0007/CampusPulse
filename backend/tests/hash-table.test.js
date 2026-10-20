import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HashTable } from '../dsa/HashTable.js';

describe('Custom Hash Table (Duplicate Detection) Unit Tests', () => {
  test('Initializes with default capacity and zero size', () => {
    const ht = new HashTable(32);
    assert.equal(ht.size(), 0);
    assert.equal(ht.capacity, 32);
  });

  test('Inserts and retrieves key-value pairs correctly', () => {
    const ht = new HashTable();
    ht.set('event1:user1', { status: 'CONFIRMED' });
    ht.set('event1:user2', { status: 'WAITLISTED', position: 1 });

    assert.equal(ht.has('event1:user1'), true);
    assert.equal(ht.get('event1:user1').status, 'CONFIRMED');
    assert.equal(ht.get('event1:user2').position, 1);
    assert.equal(ht.size(), 2);
  });

  test('Returns undefined for non-existent keys and false for has()', () => {
    const ht = new HashTable();
    assert.equal(ht.get('unknown:key'), undefined);
    assert.equal(ht.has('unknown:key'), false);
  });

  test('Updates existing key in-place without incrementing size', () => {
    const ht = new HashTable();
    ht.set('event1:user1', { status: 'WAITLISTED' });
    assert.equal(ht.get('event1:user1').status, 'WAITLISTED');
    assert.equal(ht.size(), 1);

    ht.set('event1:user1', { status: 'CONFIRMED' });
    assert.equal(ht.get('event1:user1').status, 'CONFIRMED');
    assert.equal(ht.size(), 1);
  });

  test('Deletes keys correctly and decrements size', () => {
    const ht = new HashTable();
    ht.set('event1:user1', 'data1');
    ht.set('event1:user2', 'data2');

    assert.equal(ht.delete('event1:user1'), true);
    assert.equal(ht.has('event1:user1'), false);
    assert.equal(ht.size(), 1);

    assert.equal(ht.delete('non_existent'), false);
    assert.equal(ht.size(), 1);
  });

  test('Handles hash collisions gracefully using separate chaining', () => {
    // Create tiny capacity to deliberately force multiple collisions
    const tinyHt = new HashTable(4);
    const keys = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
    
    keys.forEach((key, idx) => {
      tinyHt.set(key, `val_${idx}`);
    });

    keys.forEach((key, idx) => {
      assert.equal(tinyHt.has(key), true);
      assert.equal(tinyHt.get(key), `val_${idx}`);
    });
  });

  test('Throws TypeError when setting null or undefined key', () => {
    const ht = new HashTable();
    assert.throws(() => ht.set(null, 'val'), TypeError);
    assert.throws(() => ht.set(undefined, 'val'), TypeError);
  });

  test('Dynamic resizing preserves all entries and updates capacity', () => {
    const ht = new HashTable(4); // threshold = 4 * 0.75 = 3 items
    ht.set('k1', 1);
    ht.set('k2', 2);
    ht.set('k3', 3);
    ht.set('k4', 4); // Triggers resize to capacity 8

    assert.ok(ht.capacity >= 8);
    assert.equal(ht.size(), 4);
    assert.equal(ht.get('k1'), 1);
    assert.equal(ht.get('k2'), 2);
    assert.equal(ht.get('k3'), 3);
    assert.equal(ht.get('k4'), 4);
  });
});
