export interface ActionBudget {
  allowedApps: string[];
  allowedDomains: string[];
  allowedActions: string[];
  blockedActions: string[];
  maxSteps: number;
  sensitiveMode: boolean;
  scope: 'browser' | 'native' | 'mixed';
}

export interface BudgetViolation {
  allowed: boolean;
  reason: string;
  severity: 'block' | 'warn' | 'allow';
}

// Patterns always blocked regardless of budget
const ALWAYS_BLOCKED_PATTERNS = [
  /\bterminal\b/i,
  /\bshell\b/i,
  /\bsudo\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\beval\b/i,
  /\bexec\b/i,
  /\brm\s+-rf\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bpowershell\b/i,
  /\bcmd\.exe\b/i,
  /\bbash\b/i,
  /\bsh\s+-c\b/i,
];

export const DEFAULT_BUDGET: ActionBudget = {
  allowedApps: [],
  allowedDomains: [],
  allowedActions: ['click', 'type', 'key', 'scroll'],
  blockedActions: ['terminal', 'shell', 'sudo', 'curl', 'wget', 'eval'],
  maxSteps: 10,
  sensitiveMode: false,
  scope: 'mixed',
};

const BUDGET_SYSTEM_PROMPT = `You are a security policy generator for an AI desktop agent. Given a task description, generate a minimal action budget in JSON.

Output ONLY valid JSON with this exact structure:
{
  "allowedApps": ["AppName1", "AppName2"],
  "allowedDomains": ["example.com"],
  "allowedActions": ["click", "type", "key", "scroll"],
  "blockedActions": ["terminal", "shell", "sudo"],
  "maxSteps": 15,
  "sensitiveMode": false,
  "scope": "browser"
}

Rules:
- scope: "browser" for web tasks, "native" for desktop-only tasks, "mixed" for both
- allowedApps: only apps explicitly needed for the task
- allowedDomains: only domains explicitly mentioned or clearly required
- allowedActions: always include click, type, key, scroll at minimum
- blockedActions: always include terminal, shell, sudo, curl, wget, eval
- maxSteps: 10-30 depending on task complexity
- sensitiveMode: true if task involves passwords, credentials, or financial data
- Be restrictive. Only allow what is clearly needed.`;

export async function generateBudget(
  task: string,
  callTextModel: (user: string, system: string) => Promise<string>,
): Promise<ActionBudget> {
  try {
    const response = await callTextModel(
      `Generate an action budget for this task: "${task}"`,
      BUDGET_SYSTEM_PROMPT,
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ...DEFAULT_BUDGET };

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and fill defaults
    const budget: ActionBudget = {
      allowedApps: Array.isArray(parsed.allowedApps) ? parsed.allowedApps : [],
      allowedDomains: Array.isArray(parsed.allowedDomains) ? parsed.allowedDomains : [],
      allowedActions: Array.isArray(parsed.allowedActions) ? parsed.allowedActions : DEFAULT_BUDGET.allowedActions,
      blockedActions: Array.isArray(parsed.blockedActions) ? parsed.blockedActions : DEFAULT_BUDGET.blockedActions,
      maxSteps: typeof parsed.maxSteps === 'number' ? parsed.maxSteps : DEFAULT_BUDGET.maxSteps,
      sensitiveMode: typeof parsed.sensitiveMode === 'boolean' ? parsed.sensitiveMode : false,
      scope: ['browser', 'native', 'mixed'].includes(parsed.scope) ? parsed.scope : 'mixed',
    };

    // Always enforce blocked patterns
    for (const alwaysBlocked of ['terminal', 'shell', 'sudo', 'curl', 'wget', 'eval']) {
      if (!budget.blockedActions.includes(alwaysBlocked)) {
        budget.blockedActions.push(alwaysBlocked);
      }
    }

    return budget;
  } catch {
    return { ...DEFAULT_BUDGET };
  }
}

export function enforceBudget(actionDesc: string, budget: ActionBudget): BudgetViolation {
  const lower = actionDesc.toLowerCase();

  // Check always-blocked shell/system patterns first
  for (const pattern of ALWAYS_BLOCKED_PATTERNS) {
    if (pattern.test(actionDesc)) {
      return {
        allowed: false,
        reason: `Action matches always-blocked pattern: ${pattern.source}`,
        severity: 'block',
      };
    }
  }

  // Check budget's blocked actions
  for (const blocked of budget.blockedActions) {
    if (lower.includes(blocked.toLowerCase())) {
      return {
        allowed: false,
        reason: `Action "${actionDesc}" contains blocked action: ${blocked}`,
        severity: 'block',
      };
    }
  }

  // Check domain restrictions
  const urlMatch = actionDesc.match(/https?:\/\/([^/\s]+)/i) || actionDesc.match(/(?:navigate|go to|open)\s+([a-z0-9.-]+\.[a-z]{2,})/i);
  if (urlMatch && budget.allowedDomains.length > 0) {
    const domain = urlMatch[1].toLowerCase();
    const domainAllowed = budget.allowedDomains.some(d => {
      const allowed = d.toLowerCase();
      // Exact match or subdomain match (domain ends with .allowed)
      return domain === allowed || domain.endsWith('.' + allowed);
    });
    if (!domainAllowed) {
      return {
        allowed: true,
        reason: `Domain ${domain} not in allowed list: [${budget.allowedDomains.join(', ')}]`,
        severity: 'warn',
      };
    }
  }

  // Check app restrictions
  if (budget.allowedApps.length > 0) {
    const openMatch = actionDesc.match(/(?:open|launch|start)\s+([^\s]+(?:\s[^\s]+)?)/i);
    if (openMatch) {
      const appName = openMatch[1];
      const appAllowed = budget.allowedApps.some(a =>
        appName.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(appName.toLowerCase()),
      );
      if (!appAllowed) {
        return {
          allowed: true,
          reason: `App "${appName}" not in allowed apps: [${budget.allowedApps.join(', ')}]`,
          severity: 'warn',
        };
      }
    }
  }

  return {
    allowed: true,
    reason: 'Action within budget',
    severity: 'allow',
  };
}
