import { describe, expect, it } from 'vitest';
import { MAX_SCORE, QUESTION_COUNT, QUIZ_BLOCKS, focusBlocks, isCompleteAnswers, scoreQuiz, tierForScore } from './quiz';
import type { AnswerValue } from './types';

const answers = (fill: AnswerValue) => Array<AnswerValue>(QUESTION_COUNT).fill(fill);

describe('quiz', () => {
  it('содержит 25 вопросов в 5 блоках, максимум 50 баллов', () => {
    expect(QUESTION_COUNT).toBe(25);
    expect(QUIZ_BLOCKS).toHaveLength(5);
    expect(MAX_SCORE).toBe(50);
  });

  it('границы результатов совпадают с документом: 0–12, 13–30, 31–50', () => {
    expect(tierForScore(0)).toBe('good');
    expect(tierForScore(12)).toBe('good');
    expect(tierForScore(13)).toBe('attention');
    expect(tierForScore(30)).toBe('attention');
    expect(tierForScore(31)).toBe('priority');
    expect(tierForScore(50)).toBe('priority');
  });

  it('считает баллы по блокам', () => {
    const a = answers(0);
    a[0] = 2; // энергия
    a[5] = 1; // пищеварение
    a[24] = 2; // привычки
    const r = scoreQuiz(a);
    expect(r.score).toBe(5);
    expect(r.blockScores).toEqual([2, 1, 0, 0, 2]);
    expect(r.tier).toBe('good');
    expect(scoreQuiz(answers(2))).toMatchObject({ score: 50, tier: 'priority' });
  });

  it('отклоняет неполные и некорректные ответы', () => {
    expect(isCompleteAnswers(answers(1).slice(1))).toBe(false);
    expect(isCompleteAnswers([...answers(1).slice(1), 3])).toBe(false);
    expect(() => scoreQuiz([1, 2] as AnswerValue[])).toThrow();
  });

  it('выбирает зоны фокуса по убыванию баллов', () => {
    expect(focusBlocks([2, 8, 0, 8, 1])).toEqual([1, 3]);
    expect(focusBlocks([0, 0, 0, 0, 0])).toEqual([]);
  });
});
