import { describe, it } from 'node:test';
import assert from 'node:assert';
import { questionBank, Topic, Difficulty } from './question-bank.js';

describe('Question Bank', () => {
  it('contains exactly 90 entries', () => {
    assert.strictEqual(questionBank.length, 90);
  });

  it('contains unique IDs for all entries', () => {
    const ids = questionBank.map(q => q.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size);
  });

  it('contains exactly five questions for every topic/difficulty combination', () => {
    const topics: Topic[] = ['DSA', 'OS', 'DBMS', 'CN', 'OOP', 'System Design'];
    const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

    for (const topic of topics) {
      for (const diff of difficulties) {
        const count = questionBank.filter(q => q.topic === topic && q.difficulty === diff).length;
        assert.strictEqual(count, 5, `Expected 5 questions for ${topic} / ${diff}, but found ${count}`);
      }
    }
  });

  it('ensures every question has valid text, subtopic, and tags', () => {
    for (const q of questionBank) {
      assert.ok(q.questionText && q.questionText.trim().length > 0, `Invalid text for ID ${q.id}`);
      assert.ok(q.subtopic && q.subtopic.trim().length > 0, `Invalid subtopic for ID ${q.id}`);
      assert.ok(Array.isArray(q.tags) && q.tags.length > 0, `Invalid tags for ID ${q.id}`);
    }
  });
});
