import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Queue } from '../dsa/Queue.js';
import { HashTable } from '../dsa/HashTable.js';

describe('Concurrency & Waitlist Engine Simulation Tests', () => {
  test('Simulates 10 concurrent registrations for an event with capacity 3', async () => {
    const capacity = 3;
    let confirmedCount = 0;
    const confirmedRegistrations = [];
    const waitlistQueue = new Queue();
    const duplicateLookup = new HashTable();

    const simulateRegister = async (studentId, studentName) => {
      const key = `evt_concurrency:${studentId}`;
      if (duplicateLookup.has(key)) {
        return { success: false, error: 'DUPLICATE' };
      }

      if (confirmedCount < capacity) {
        confirmedCount++;
        const record = { studentId, studentName, status: 'CONFIRMED' };
        confirmedRegistrations.push(record);
        duplicateLookup.set(key, record);
        return { success: true, status: 'CONFIRMED' };
      } else {
        const queuePosition = waitlistQueue.size() + 1;
        const record = { studentId, studentName, status: 'WAITLISTED', queuePosition };
        waitlistQueue.enqueue(record);
        duplicateLookup.set(key, record);
        return { success: true, status: 'WAITLISTED', queuePosition };
      }
    };

    // 10 students register concurrently
    const promises = Array.from({ length: 10 }, (_, i) => 
      simulateRegister(`student_${i + 1}`, `Student ${i + 1}`)
    );

    const results = await Promise.all(promises);

    // Exactly 3 must be CONFIRMED
    const confirmed = results.filter(r => r.status === 'CONFIRMED');
    const waitlisted = results.filter(r => r.status === 'WAITLISTED');

    assert.equal(confirmed.length, 3);
    assert.equal(waitlisted.length, 7);
    assert.equal(waitlistQueue.size(), 7);

    // Verify FIFO Queue order: first waitlisted student gets position 1
    assert.equal(waitlistQueue.peek().studentId, 'student_4');
    assert.equal(waitlistQueue.peek().queuePosition, 1);
  });

  test('Simulates atomic cancellation and FIFO waitlist promotion', async () => {
    const waitlistQueue = new Queue();
    waitlistQueue.enqueue({ studentId: 'student_4', name: 'Student 4', status: 'WAITLISTED' });
    waitlistQueue.enqueue({ studentId: 'student_5', name: 'Student 5', status: 'WAITLISTED' });

    // Cancel a confirmed attendee
    let confirmedCount = 3;
    confirmedCount--; // Vacates a seat

    // Automatically dequeue next waitlisted candidate
    const promotedCandidate = waitlistQueue.dequeue();
    assert.ok(promotedCandidate);
    assert.equal(promotedCandidate.studentId, 'student_4');
    
    promotedCandidate.status = 'CONFIRMED';
    confirmedCount++;

    assert.equal(confirmedCount, 3);
    assert.equal(waitlistQueue.size(), 1);
    assert.equal(waitlistQueue.peek().studentId, 'student_5');
  });

  test('Rejects duplicate registration attempts from same student', async () => {
    const duplicateLookup = new HashTable();
    duplicateLookup.set('evt_1:student_99', { status: 'CONFIRMED' });

    assert.equal(duplicateLookup.has('evt_1:student_99'), true);
    assert.equal(duplicateLookup.get('evt_1:student_99').status, 'CONFIRMED');
  });
});
