export interface InjectionResult {
  detected: boolean;
  patterns: Array<{ category: string; matched: string; confidence: number }>;
  severity: 'none' | 'low' | 'medium' | 'high';
  sanitized: string;
}

interface PatternDef {
  category: string;
  severity: 'high' | 'medium';
  patterns: RegExp[];
}

const PATTERN_DEFS: PatternDef[] = [
  {
    category: 'instruction_override',
    severity: 'high',
    patterns: [
      /ignore.*previous.*instructions/i,
      /disregard.*instructions/i,
      /forget.*instructions/i,
      /new instructions:/i,
      /override.*safety/i,
      /system prompt/i,
      /you must now/i,
      /from now on.*you/i,
    ],
  },
  {
    category: 'role_play',
    severity: 'medium',
    patterns: [
      /you are now/i,
      /pretend.*to be/i,
      /act as.*you/i,
      /assume.*role/i,
      /switch to\s+(?:developer|jailbreak|dan|god|admin|unrestricted|bypass|unlimited|no.restriction)\s*mode/i,
      /DAN mode/i,
      /jailbreak/i,
    ],
  },
  {
    category: 'authority',
    severity: 'high',
    patterns: [
      /admin.*override/i,
      /developer mode/i,
      /maintenance mode/i,
      /god mode/i,
      /I am.*admin/i,
      /I am.*developer/i,
      /root access/i,
    ],
  },
  {
    category: 'delimiter',
    severity: 'high',
    patterns: [
      /```\s*(system|assistant)/i,
      /###\s*SYSTEM/i,
      /<\|im_start\|>/i,
      /<\|im_end\|>/i,
      /\[INST\]/i,
      /<<SYS>>/i,
      /^Human:/m,
      /^Assistant:/m,
    ],
  },
  {
    category: 'social_engineering',
    severity: 'medium',
    patterns: [
      /the user.*asked me to/i,
      /I was told to/i,
      /for testing purposes/i,
      /this is.*a test/i,
      /please.*bypass/i,
    ],
  },
];

// Base64 pattern: 20+ chars of base64 that decodes to printable ASCII
const BASE64_PATTERN = /[A-Za-z0-9+/]{20,}={0,2}/g;
// Zero-width characters
const ZERO_WIDTH_PATTERN = /[\u200B\u200C\u200D\uFEFF\u2060]/g;

function detectEncoded(text: string): Array<{ category: string; matched: string; confidence: number }> {
  const matches: Array<{ category: string; matched: string; confidence: number }> = [];

  // Detect zero-width characters
  const zwMatches = text.match(ZERO_WIDTH_PATTERN);
  if (zwMatches && zwMatches.length > 0) {
    matches.push({ category: 'encoded', matched: `zero-width chars (${zwMatches.length})`, confidence: 0.7 });
  }

  // Detect base64 strings > 20 chars that decode to ASCII
  const b64Matches = text.match(BASE64_PATTERN);
  if (b64Matches) {
    for (const b64 of b64Matches) {
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        // Check if decoded is printable ASCII (not binary garbage)
        if (/^[\x20-\x7E\r\n\t]+$/.test(decoded) && decoded.length > 5) {
          matches.push({ category: 'encoded', matched: b64.substring(0, 30) + (b64.length > 30 ? '...' : ''), confidence: 0.6 });
        }
      } catch {
        // Not valid base64
      }
    }
  }

  return matches;
}

export class InjectionDetector {
  detect(text: string): InjectionResult {
    const foundPatterns: Array<{ category: string; matched: string; confidence: number }> = [];
    let sanitized = text;

    for (const def of PATTERN_DEFS) {
      for (const pattern of def.patterns) {
        const match = text.match(pattern);
        if (match) {
          foundPatterns.push({
            category: def.category,
            matched: match[0],
            confidence: def.severity === 'high' ? 0.9 : 0.7,
          });
          sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
      }
    }

    // Check encoded patterns
    const encodedMatches = detectEncoded(text);
    foundPatterns.push(...encodedMatches);
    if (encodedMatches.length > 0) {
      sanitized = sanitized
        .replace(ZERO_WIDTH_PATTERN, '')
        .replace(BASE64_PATTERN, (m) => {
          try {
            const decoded = Buffer.from(m, 'base64').toString('utf-8');
            if (/^[\x20-\x7E\r\n\t]+$/.test(decoded) && decoded.length > 5) {
              return '[REDACTED]';
            }
          } catch { /* not base64 */ }
          return m;
        });
    }

    const severity = computeSeverity(foundPatterns);

    return {
      detected: foundPatterns.length > 0,
      patterns: foundPatterns,
      severity,
      sanitized,
    };
  }
}

function computeSeverity(
  patterns: Array<{ category: string; matched: string; confidence: number }>,
): 'none' | 'low' | 'medium' | 'high' {
  if (patterns.length === 0) return 'none';

  const highCategories = new Set(['instruction_override', 'authority', 'delimiter']);
  const hasHigh = patterns.some(p => highCategories.has(p.category));
  if (hasHigh) return 'high';

  const mediumCategories = new Set(['role_play', 'social_engineering', 'encoded']);
  const mediumCount = patterns.filter(p => mediumCategories.has(p.category)).length;
  if (mediumCount >= 2) return 'high';
  if (mediumCount >= 1) return 'medium';

  return 'none';
}
