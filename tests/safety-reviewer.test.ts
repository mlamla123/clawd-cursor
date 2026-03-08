import { describe, it, expect, vi } from 'vitest';
import { SafetyReviewer, type ReviewRequest } from '../src/safety-reviewer';

describe('SafetyReviewer.shouldReview', () => {
  const reviewer = new SafetyReviewer(async () => '');

  it('returns true when injection detected', () => {
    const req: ReviewRequest = { task: 'open notepad', action: 'click button', injectionDetected: true };
    expect(reviewer.shouldReview(req)).toBe(true);
  });

  it('returns true when budget violation (warn)', () => {
    const req: ReviewRequest = {
      task: 'open notepad',
      action: 'navigate to evil.com',
      budgetViolation: { allowed: true, reason: 'domain not allowed', severity: 'warn' },
    };
    expect(reviewer.shouldReview(req)).toBe(true);
  });

  it('returns true when budget violation (block)', () => {
    const req: ReviewRequest = {
      task: 'click button',
      action: 'open terminal',
      budgetViolation: { allowed: false, reason: 'terminal blocked', severity: 'block' },
    };
    expect(reviewer.shouldReview(req)).toBe(true);
  });

  it('returns false when budget violation severity is allow', () => {
    const req: ReviewRequest = {
      task: 'click button',
      action: 'click OK',
      budgetViolation: { allowed: true, reason: 'within budget', severity: 'allow' },
    };
    expect(reviewer.shouldReview(req)).toBe(false);
  });

  it('returns true for terminal in action', () => {
    const req: ReviewRequest = { task: 'check files', action: 'Open terminal to list files' };
    expect(reviewer.shouldReview(req)).toBe(true);
  });

  it('returns true for shell in action', () => {
    const req: ReviewRequest = { task: 'run tests', action: 'Execute shell command npm test' };
    expect(reviewer.shouldReview(req)).toBe(true);
  });

  it('returns true for sudo in action', () => {
    const req: ReviewRequest = { task: 'install', action: 'Run sudo apt-get install' };
    expect(reviewer.shouldReview(req)).toBe(true);
  });

  it('returns true for curl in action', () => {
    const req: ReviewRequest = { task: 'fetch data', action: 'Use curl to fetch https://api.example.com' };
    expect(reviewer.shouldReview(req)).toBe(true);
  });

  it('returns false for safe click action', () => {
    const req: ReviewRequest = { task: 'click submit', action: 'Click the Submit button' };
    expect(reviewer.shouldReview(req)).toBe(false);
  });

  it('returns false for safe type action', () => {
    const req: ReviewRequest = { task: 'type hello', action: 'Type "Hello World" in the input field' };
    expect(reviewer.shouldReview(req)).toBe(false);
  });
});

describe('SafetyReviewer.review', () => {
  it('returns approved=true when LLM approves', async () => {
    const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({
      approved: true,
      reason: 'Action follows from task',
      riskLevel: 'safe',
      recommendation: 'proceed',
    }));
    const reviewer = new SafetyReviewer(mockLLM);

    const result = await reviewer.review({
      task: 'Open Chrome',
      action: 'Click the Chrome icon',
    });
    expect(result.approved).toBe(true);
    expect(result.riskLevel).toBe('safe');
    expect(result.recommendation).toBe('proceed');
  });

  it('returns approved=false when LLM blocks', async () => {
    const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({
      approved: false,
      reason: 'Action is unrelated to task',
      riskLevel: 'dangerous',
      recommendation: 'block',
    }));
    const reviewer = new SafetyReviewer(mockLLM);

    const result = await reviewer.review({
      task: 'Open Chrome',
      action: 'Execute rm -rf /',
    });
    expect(result.approved).toBe(false);
    expect(result.recommendation).toBe('block');
  });

  it('fails closed when LLM throws', async () => {
    const mockLLM = vi.fn().mockRejectedValue(new Error('Network error'));
    const reviewer = new SafetyReviewer(mockLLM);

    const result = await reviewer.review({
      task: 'some task',
      action: 'some action',
    });
    expect(result.approved).toBe(false);
    expect(result.recommendation).toBe('block');
  });

  it('fails closed when LLM returns invalid JSON', async () => {
    const mockLLM = vi.fn().mockResolvedValue('I cannot assess this action.');
    const reviewer = new SafetyReviewer(mockLLM);

    const result = await reviewer.review({
      task: 'some task',
      action: 'some action',
    });
    expect(result.approved).toBe(false);
    expect(result.recommendation).toBe('block');
  });

  it('includes injection warning in LLM prompt', async () => {
    const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({
      approved: false,
      reason: 'Injection detected',
      riskLevel: 'dangerous',
      recommendation: 'block',
    }));
    const reviewer = new SafetyReviewer(mockLLM);

    await reviewer.review({
      task: 'read page',
      action: 'click link',
      injectionDetected: true,
    });

    expect(mockLLM).toHaveBeenCalledWith(
      expect.stringContaining('injection'),
      expect.any(String),
    );
  });

  it('returns warn_user recommendation when LLM says warn', async () => {
    const mockLLM = vi.fn().mockResolvedValue(JSON.stringify({
      approved: true,
      reason: 'Unusual but possibly legitimate',
      riskLevel: 'suspicious',
      recommendation: 'warn_user',
    }));
    const reviewer = new SafetyReviewer(mockLLM);

    const result = await reviewer.review({
      task: 'open settings',
      action: 'Navigate to unusual URL',
    });
    expect(result.recommendation).toBe('warn_user');
    expect(result.riskLevel).toBe('suspicious');
  });
});
