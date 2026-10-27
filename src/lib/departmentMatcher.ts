// Department auto-match with synonym map + fuzzy (Levenshtein/Dice) scoring.
// Returns the best match plus confidence (0-1) and method (exact|synonym|fuzzy|none).

export type MatchMethod = "exact" | "synonym" | "fuzzy" | "none";

export interface DeptLite {
  id: string;
  name: string;
}

export interface MatchResult {
  department: DeptLite | null;
  method: MatchMethod;
  confidence: number; // 0..1
}

// Canonical synonym map. Each key is a normalized canonical name; values are
// alternative phrasings the AI might suggest.
const SYNONYMS: Record<string, string[]> = {
  "public works": ["pwd", "roads", "road", "street maintenance", "infrastructure", "highways", "streets"],
  "sanitation": ["garbage", "waste", "trash", "cleaning", "swachh", "solid waste", "refuse"],
  "electrical": ["electricity", "street lighting", "street lights", "lights", "lighting", "power"],
  "water supply": ["water", "water board", "drinking water", "water department", "jal", "water dept"],
  "drainage": ["sewage", "sewer", "storm water", "stormwater", "drains"],
  "parks and trees": ["parks", "horticulture", "tree fall", "trees", "garden", "gardens", "greenery"],
  "traffic management": ["traffic", "signals", "traffic signals", "transport", "rto"],
  "building department": ["building", "construction", "buildings", "urban planning"],
  "health": ["public health", "medical", "hospital", "sanitary inspector"],
};

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(department|dept|division|section|board|of|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s: string): string[] => normalize(s).split(" ").filter(Boolean);

// Sørensen–Dice coefficient on bigrams — robust short-name fuzzy match.
const dice = (a: string, b: string): number => {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) || 0) + 1);
    }
    return m;
  };
  const aMap = bigrams(a);
  const bMap = bigrams(b);
  let intersection = 0;
  for (const [bg, count] of aMap) {
    if (bMap.has(bg)) intersection += Math.min(count, bMap.get(bg)!);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
};

// Token-overlap score (Jaccard) — handles "Water" vs "Water Supply".
const tokenOverlap = (a: string, b: string): number => {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  return inter / union;
};

const fuzzyScore = (a: string, b: string): number => {
  const na = normalize(a);
  const nb = normalize(b);
  const d = dice(na.replace(/\s/g, ""), nb.replace(/\s/g, ""));
  const t = tokenOverlap(na, nb);
  // Weighted blend: token overlap is more meaningful for multi-word names.
  return Math.max(d, t * 0.9 + d * 0.1);
};

/**
 * Match a free-form AI suggestion against the existing department list.
 */
export const matchDepartment = (
  suggested: string,
  departments: DeptLite[]
): MatchResult => {
  const suggestion = (suggested || "").trim();
  if (!suggestion || departments.length === 0) {
    return { department: null, method: "none", confidence: 0 };
  }

  const ns = normalize(suggestion);

  // 1) Exact normalized match.
  for (const d of departments) {
    if (normalize(d.name) === ns) {
      return { department: d, method: "exact", confidence: 1 };
    }
  }

  // 2) Synonym map — does the suggestion (or any dept name) map to a canonical?
  const resolveCanonical = (text: string): string | null => {
    const n = normalize(text);
    if (SYNONYMS[n]) return n;
    for (const [canon, alts] of Object.entries(SYNONYMS)) {
      if (n === canon) return canon;
      for (const alt of alts) {
        if (n === alt || n.includes(alt) || alt.includes(n)) return canon;
      }
    }
    return null;
  };

  const suggestionCanon = resolveCanonical(suggestion);
  if (suggestionCanon) {
    for (const d of departments) {
      const deptCanon = resolveCanonical(d.name);
      if (deptCanon === suggestionCanon || normalize(d.name) === suggestionCanon) {
        return { department: d, method: "synonym", confidence: 0.92 };
      }
    }
  }

  // 3) Fuzzy — pick the highest-scoring department.
  let best: DeptLite | null = null;
  let bestScore = 0;
  for (const d of departments) {
    const s = fuzzyScore(suggestion, d.name);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }

  if (best && bestScore >= 0.5) {
    return { department: best, method: "fuzzy", confidence: Math.min(0.99, bestScore) };
  }

  return { department: null, method: "none", confidence: bestScore };
};

export const methodLabel = (m: MatchMethod): string => {
  switch (m) {
    case "exact": return "Exact match";
    case "synonym": return "Synonym match";
    case "fuzzy": return "Fuzzy match";
    default: return "No match";
  }
};