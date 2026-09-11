/** OneJarc frontend snapshot from company-tool-hub/lib/tool-search.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/**
 * Deterministic, browser-only tool recommendations.
 * Match complete normalized words rather than substrings (file != profile).
 * These relevance scores are ranking signals, not AI confidence percentages.
 * A future recommendation API can return this same result/clarification shape.
 */
export type SearchableTool = {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  tasks: string[];
  keywords: string[];
  category: string;
  reason: string;
};

export type ToolMatch<T extends SearchableTool> = {
  tool: T;
  score: number;
  match: string;
  bestTask: string;
};

export type SearchAnalysis<T extends SearchableTool> = {
  results: ToolMatch<T>[];
  correction: string | null;
  clarification: {
    question: string;
    options: { label: string; query: string }[];
  } | null;
};

// Common sentence/action words must not recommend unrelated apps on their own.
const STOP_WORDS = new Set(
  (
    'i me my we our you your a an the to for from with in on of and or ' +
    'can cant cannot not does doesnt dont do how what which is are have has need needs want would ' +
    'please help get new make create request submit find view open use tool tools app apps company ' +
    'next week today something it its this that some working work'
  ).split(' '),
);

/** Normalize punctuation, accents, contractions, and whitespace consistently. */
export function normalizeQuery(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold ordinary plurals without shortening words such as access or analytics. */
function wordRoot(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  return word.length > 4 && word.endsWith('s') && !/(ss|is|ics)$/.test(word)
    ? word.slice(0, -1)
    : word;
}

function words(text: string): string[] {
  return normalizeQuery(text)
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(wordRoot);
}

/** Edit distance with adjacent-letter swaps; bounded short terms stay conservative. */
function typoDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  rows[0] = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[left.length][right.length];
}

// Explicit intent vocabulary is easier to review and tune than hidden heuristics.
const INTENT_TERMS: [RegExp, string[]][] = [
  [/\b(time off|annual leave|vacation|holiday|leave)\b/, ['leave', 'vacation']],
  [
    /\b(reimbursement|reimburse|refund|claim|expenses|expense)\b/,
    ['expense', 'reimbursement'],
  ],
  [/\b(slides|presentation|poster)\b/, ['presentation', 'design']],
  [
    /\b(locked out|cant sign in|cannot sign in|log in|login|reset password)\b/,
    ['password', 'support'],
  ],
  [/\b(purchasing|purchase|buy|supplier|vendor)\b/, ['purchase', 'supplier']],
];

/**
 * Return ranked tools plus an optional spelling explanation or clarifying choice.
 * Troubleshooting routes to the service desk; it does not infer a random affected
 * app from a word fragment. Empty input keeps the normal alphabetical directory.
 */
export function searchToolCatalog<T extends SearchableTool>(
  catalog: T[],
  input: string,
): SearchAnalysis<T> {
  const original = normalizeQuery(input);
  if (!original)
    return {
      results: catalog
        .map((tool) => ({
          tool,
          score: 1,
          match: '',
          bestTask: tool.tasks[0] ?? '',
        }))
        .sort((a, b) => a.tool.name.localeCompare(b.tool.name)),
      correction: null,
      clarification: null,
    };

  const vocabulary = new Set(
    catalog.flatMap((tool) =>
      words(
        [
          tool.name,
          ...tool.aliases,
          ...tool.tasks,
          ...tool.keywords,
          tool.category,
        ].join(' '),
      ),
    ),
  );
  // Domain terms that should never be "corrected" into an unrelated catalog word.
  for (const term of [
    'upload',
    'file',
    'attachment',
    'error',
    'broken',
    'unable',
    'fail',
    'report',
  ])
    vocabulary.add(term);
  const corrected = original
    .split(' ')
    .map((word) => {
      if (
        STOP_WORDS.has(word) ||
        word.length < 4 ||
        vocabulary.has(wordRoot(word))
      )
        return word;
      const limit = word.length >= 8 ? 2 : 1;
      const candidates = [...vocabulary]
        .filter(
          (candidate) =>
            candidate[0] === word[0] &&
            Math.abs(candidate.length - word.length) <= limit,
        )
        .map((candidate) => ({
          word: candidate,
          distance: typoDistance(word, candidate),
        }))
        .filter((candidate) => candidate.distance <= limit)
        .sort((a, b) => a.distance - b.distance);
      // Do not silently choose between equally plausible spelling corrections.
      return candidates[0] &&
        (!candidates[1] || candidates[0].distance < candidates[1].distance)
        ? candidates[0].word
        : word;
    })
    .join(' ');
  const originalTerms = new Set(words(corrected));
  const terms = new Set(originalTerms);
  for (const [pattern, expansions] of INTENT_TERMS) {
    if (pattern.test(corrected))
      expansions.forEach((term) => terms.add(wordRoot(term)));
  }

  const namedTools = catalog.filter((tool) =>
    [tool.name, ...tool.aliases].some((name) => {
      const phrase = normalizeQuery(name);
      return ` ${corrected} `.includes(` ${phrase} `);
    }),
  );
  const uploadIssue =
    /\b(upload|file|attachment)\b/.test(corrected) &&
    /\b(cant|cannot|unable|error|issue|problem|broken|fail|fails|failed|not)\b/.test(
      corrected,
    );
  const troubleshooting =
    uploadIssue ||
    /\b(locked out|cant sign in|cannot sign in|broken|error|not working|doesnt work|report an issue|report a problem)\b/.test(
      corrected,
    );
  let clarification: SearchAnalysis<T>['clarification'] = null;
  if (
    uploadIssue &&
    !namedTools.length &&
    !/\b(report|ticket|support)\b/.test(corrected)
  ) {
    clarification = {
      question: 'Which tool is having trouble with file uploads?',
      options: [
        { label: 'Connect', query: 'Connect file upload problem' },
        { label: 'People Hub', query: 'People Hub file upload problem' },
        {
          label: 'Another tool / not sure',
          query: 'Report an issue with file uploads',
        },
      ],
    };
  } else if (terms.size === 1 && terms.has('report')) {
    clarification = {
      question: 'Do you want to report a problem or read a business report?',
      options: [
        { label: 'Report a problem', query: 'report an issue' },
        { label: 'Business reports', query: 'analytics dashboard report' },
      ],
    };
  } else if (terms.size === 0) {
    clarification = {
      question: 'What would you like to get done?',
      options: [
        { label: 'Request leave', query: 'request leave' },
        { label: 'Claim expenses', query: 'claim an expense' },
        { label: 'Get IT help', query: 'report an issue' },
      ],
    };
  }

  const results = catalog
    .map((tool) => {
      const fields: [Set<string>, number][] = [
        [new Set(words(tool.name)), 30],
        [new Set(words(tool.aliases.join(' '))), 22],
        [new Set(words(tool.keywords.join(' '))), 18],
        [new Set(words(tool.tasks.join(' '))), 12],
        [new Set(words(tool.category)), 18],
        [new Set(words(tool.description)), 3],
      ];
      let score = fields.reduce(
        (total, [field, weight]) =>
          total + [...terms].filter((term) => field.has(term)).length * weight,
        0,
      );
      if (terms.size > 0 && normalizeQuery(tool.name) === corrected)
        score += 120;
      if (
        terms.size > 0 &&
        tool.aliases.some((alias) => normalizeQuery(alias) === corrected)
      )
        score += 90;
      const taskScores = tool.tasks
        .map((task) => ({
          task,
          // An explicit outcome wins over broader synonyms added for recall.
          score: words(task).reduce(
            (total, word) =>
              total + (originalTerms.has(word) ? 4 : terms.has(word) ? 1 : 0),
            0,
          ),
        }))
        .sort((a, b) => b.score - a.score);
      let bestTask = taskScores[0]?.task ?? '';
      let match = taskScores[0]?.score ? `Best for “${bestTask}”` : tool.reason;
      if (troubleshooting) {
        if (tool.id === 'service-center') {
          score += 180;
          bestTask = /\b(password|sign in|locked out|login)\b/.test(corrected)
            ? 'reset a password'
            : 'report an issue';
          match = namedTools[0]
            ? `Get IT help for ${namedTools[0].name}.`
            : 'Get help diagnosing the problem and routing it to IT.';
        } else if (!namedTools.some((named) => named.id === tool.id)) {
          score = 0; // Broad symptoms must not recommend HR or finance by accident.
        }
      }
      return { tool, score, match, bestTask };
    })
    .filter((result) => result.score >= 12)
    .sort(
      (a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name),
    );

  const strongest = results[0]?.score ?? 0;
  return {
    results: results
      .filter((result) => result.score >= strongest * 0.35)
      .slice(0, 5),
    correction: corrected !== original ? corrected : null,
    clarification,
  };
}
