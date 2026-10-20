import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSort, Comparators } from '../dsa/mergeSort.js';

describe('Stable Merge Sort Unit Tests', () => {
  const numericAsc = (a, b) => a - b;

  test('Handles empty and single-element arrays immutably', () => {
    const empty = [];
    const sortedEmpty = mergeSort(empty, numericAsc);
    assert.deepEqual(sortedEmpty, []);
    assert.notEqual(sortedEmpty, empty);

    const single = [42];
    const sortedSingle = mergeSort(single, numericAsc);
    assert.deepEqual(sortedSingle, [42]);
    assert.notEqual(sortedSingle, single);
  });

  test('Sorts pre-sorted, reverse-sorted, and randomized integer arrays', () => {
    assert.deepEqual(mergeSort([1, 2, 3, 4, 5], numericAsc), [1, 2, 3, 4, 5]);
    assert.deepEqual(mergeSort([5, 4, 3, 2, 1], numericAsc), [1, 2, 3, 4, 5]);
    assert.deepEqual(mergeSort([3, 1, 4, 1, 5, 9, 2, 6], numericAsc), [1, 1, 2, 3, 4, 5, 6, 9]);
  });

  test('Preserves stability for elements with equivalent sort keys', () => {
    // Array of participants with duplicate scores; stability requires original index order to be maintained
    const participants = [
      { id: 'p1', score: 10, arrivalIndex: 1 },
      { id: 'p2', score: 20, arrivalIndex: 2 },
      { id: 'p3', score: 10, arrivalIndex: 3 },
      { id: 'p4', score: 30, arrivalIndex: 4 },
      { id: 'p5', score: 10, arrivalIndex: 5 }
    ];

    const sorted = mergeSort(participants, (a, b) => a.score - b.score);

    // Filter score = 10 items
    const score10 = sorted.filter(p => p.score === 10);
    assert.equal(score10.length, 3);
    assert.equal(score10[0].id, 'p1');
    assert.equal(score10[1].id, 'p3');
    assert.equal(score10[2].id, 'p5');
  });

  test('Validates input types and throws TypeError on invalid arguments', () => {
    assert.throws(() => mergeSort('not an array', numericAsc), TypeError);
    assert.throws(() => mergeSort([1, 2, 3], null), TypeError);
    assert.throws(() => mergeSort([1, 2, 3], 'not a function'), TypeError);
  });

  test('Sorts realistic events by remaining seats correctly', () => {
    const events = [
      { title: 'Event A', capacity: 10, confirmed_count: 8 },  // 2 left
      { title: 'Event B', capacity: 100, confirmed_count: 50 }, // 50 left
      { title: 'Event C', capacity: 20, confirmed_count: 15 }  // 5 left
    ];

    const sorted = mergeSort(events, Comparators.byRemainingSeats);
    assert.equal(sorted[0].title, 'Event B'); // 50 remaining
    assert.equal(sorted[1].title, 'Event C'); // 5 remaining
    assert.equal(sorted[2].title, 'Event A'); // 2 remaining
  });

  test('Sorts realistic events by date ascending correctly', () => {
    const events = [
      { title: 'Future', starts_at: '2026-12-01T10:00:00Z' },
      { title: 'Past', starts_at: '2026-10-01T10:00:00Z' },
      { title: 'Now', starts_at: '2026-11-01T10:00:00Z' }
    ];

    const sorted = mergeSort(events, Comparators.byDateAscending);
    assert.equal(sorted[0].title, 'Past');
    assert.equal(sorted[1].title, 'Now');
    assert.equal(sorted[2].title, 'Future');
  });
});
