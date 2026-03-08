import { describe, it, expect, vi } from 'vitest';
import { generateBudget, enforceBudget, DEFAULT_BUDGET, type ActionBudget } from '../src/action-budget';

describe('DEFAULT_BUDGET', () => {
  it('has maxSteps of 10', () => {
    expect(DEFAULT_BUDGET.maxSteps).toBe(10);
  });

  it('allows click, type, key, scroll', () => {
    expect(DEFAULT_BUDGET.allowedActions).toContain('click');
    expect(DEFAULT_BUDGET.allowedActions).toContain('type');
    expect(DEFAULT_BUDGET.allowedActions).toContain('key');
    expect(DEFAULT_BUDGET.allowedActions).toContain('scroll');
  });

  it('blocks terminal, shell, sudo, curl, wget, eval', () => {
    expect(DEFAULT_BUDGET.blockedActions).toContain('terminal');
    expect(DEFAULT_BUDGET.blockedActions).toContain('shell');
    expect(DEFAULT_BUDGET.blockedActions).toContain('sudo');
    expect(DEFAULT_BUDGET.blockedActions).toContain('curl');
    expect(DEFAULT_BUDGET.blockedActions).toContain('wget');
    expect(DEFAULT_BUDGET.blockedActions).toContain('eval');
  });
});

describe('generateBudget', () => {
  it('returns valid budget from LLM response', async () => {
    const mockCallModel = vi.fn().mockResolvedValue(JSON.stringify({
      allowedApps: ['Chrome'],
      allowedDomains: ['github.com'],
      allowedActions: ['click', 'type', 'key', 'scroll'],
      blockedActions: ['terminal', 'shell'],
      maxSteps: 20,
      sensitiveMode: false,
      scope: 'browser',
    }));

    const budget = await generateBudget('Open GitHub and check PRs', mockCallModel);
    expect(budget.allowedApps).toContain('Chrome');
    expect(budget.allowedDomains).toContain('github.com');
    expect(budget.scope).toBe('browser');
    expect(budget.maxSteps).toBe(20);
  });

  it('falls back to DEFAULT_BUDGET when LLM fails', async () => {
    const mockCallModel = vi.fn().mockRejectedValue(new Error('LLM unavailable'));
    const budget = await generateBudget('some task', mockCallModel);
    expect(budget.maxSteps).toBe(DEFAULT_BUDGET.maxSteps);
    expect(budget.allowedActions).toEqual(DEFAULT_BUDGET.allowedActions);
  });

  it('falls back to DEFAULT_BUDGET when LLM returns invalid JSON', async () => {
    const mockCallModel = vi.fn().mockResolvedValue('Sorry, I cannot generate that.');
    const budget = await generateBudget('some task', mockCallModel);
    expect(budget.maxSteps).toBe(DEFAULT_BUDGET.maxSteps);
  });

  it('always includes terminal in blockedActions even if LLM omits it', async () => {
    const mockCallModel = vi.fn().mockResolvedValue(JSON.stringify({
      allowedApps: [],
      allowedDomains: [],
      allowedActions: ['click'],
      blockedActions: [],
      maxSteps: 5,
      sensitiveMode: false,
      scope: 'native',
    }));

    const budget = await generateBudget('click something', mockCallModel);
    expect(budget.blockedActions).toContain('terminal');
    expect(budget.blockedActions).toContain('shell');
    expect(budget.blockedActions).toContain('sudo');
  });

  it('passes task to LLM', async () => {
    const mockCallModel = vi.fn().mockResolvedValue(JSON.stringify({
      allowedApps: [],
      allowedDomains: [],
      allowedActions: ['click'],
      blockedActions: ['terminal'],
      maxSteps: 5,
      sensitiveMode: false,
      scope: 'mixed',
    }));

    await generateBudget('specific task text', mockCallModel);
    expect(mockCallModel).toHaveBeenCalledWith(
      expect.stringContaining('specific task text'),
      expect.any(String),
    );
  });
});

describe('enforceBudget', () => {
  const permissiveBudget: ActionBudget = {
    allowedApps: [],
    allowedDomains: [],
    allowedActions: ['click', 'type', 'key', 'scroll'],
    blockedActions: ['terminal', 'shell', 'sudo'],
    maxSteps: 20,
    sensitiveMode: false,
    scope: 'mixed',
  };

  it('allows normal click action', () => {
    const result = enforceBudget('Click the Submit button', permissiveBudget);
    expect(result.severity).toBe('allow');
    expect(result.allowed).toBe(true);
  });

  it('blocks terminal command', () => {
    const result = enforceBudget('Open terminal and run ls', permissiveBudget);
    expect(result.severity).toBe('block');
    expect(result.allowed).toBe(false);
  });

  it('blocks shell commands', () => {
    const result = enforceBudget('Execute shell command: echo hello', permissiveBudget);
    expect(result.severity).toBe('block');
    expect(result.allowed).toBe(false);
  });

  it('blocks sudo', () => {
    const result = enforceBudget('Run sudo apt-get install something', permissiveBudget);
    expect(result.severity).toBe('block');
    expect(result.allowed).toBe(false);
  });

  it('blocks curl even if not in budget blockedActions', () => {
    const budget = { ...permissiveBudget, blockedActions: [] };
    const result = enforceBudget('Use curl to download file', budget);
    expect(result.severity).toBe('block');
  });

  it('blocks wget even if not in budget blockedActions', () => {
    const budget = { ...permissiveBudget, blockedActions: [] };
    const result = enforceBudget('Use wget https://example.com/file', budget);
    expect(result.severity).toBe('block');
  });

  it('blocks eval', () => {
    const result = enforceBudget('eval("malicious code")', permissiveBudget);
    expect(result.severity).toBe('block');
  });

  it('warns when domain not in allowed list', () => {
    const budget = { ...permissiveBudget, allowedDomains: ['github.com'] };
    const result = enforceBudget('Navigate to https://evil.com/steal', budget);
    expect(result.severity).toBe('warn');
    expect(result.allowed).toBe(true);
  });

  it('allows domain in allowed list', () => {
    const budget = { ...permissiveBudget, allowedDomains: ['github.com'] };
    const result = enforceBudget('Navigate to https://github.com/user/repo', budget);
    expect(result.severity).toBe('allow');
  });

  it('warns when app not in allowed apps list', () => {
    const budget = { ...permissiveBudget, allowedApps: ['Chrome'] };
    const result = enforceBudget('Open Notepad to edit file', budget);
    expect(result.severity).toBe('warn');
  });

  it('allows app in allowed apps list', () => {
    const budget = { ...permissiveBudget, allowedApps: ['Chrome'] };
    const result = enforceBudget('Open Chrome browser', budget);
    expect(result.severity).toBe('allow');
  });
});
