import { Project } from '../models/Project';

// ============================================================
// Analytical Query Service
// Handles count, aggregation, and statistical queries on worklet data
// e.g., "How many worklets have status as average?"
// ============================================================

export interface AnalyticalResult {
  isAnalytical: boolean;
  answer: string;
  data?: Record<string, any>;
}

// Fields users can ask about
const QUERYABLE_FIELDS: Record<string, string> = {
  'status': 'status',
  'stage': 'stage',
  'domain': 'domain',
  'college': 'college',
  'institution': 'college',
  'university': 'college',
  'mentor': 'mentors',
  'mentors': 'mentors',
  'student': 'students',
  'students': 'students',
  'professor': 'professors',
  'professors': 'professors',
};

// All field keywords for quick lookup
const ALL_FIELD_KEYWORDS = Object.keys(QUERYABLE_FIELDS);

// Known status values (case-insensitive matching)
const KNOWN_STATUSES = ['excellent', 'good', 'average', 'below average', 'poor', 'active', 'completed', 'dropped', 'ongoing', 'review', 'inactive'];
const KNOWN_STAGES = ['review', 'development', 'testing', 'completed', 'planning', 'deployment', 'initial', 'final', 'midterm', 'ongoing'];

// Stop words that should never be detected as a value
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'of', 'as', 'is', 'are', 'there', 'have', 'has', 'many', 'much', 'do', 'does', 'total', 'how', 'what', 'which', 'all', 'be', 'been', 'being', 'was', 'were', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'that', 'this', 'these', 'those', 'it', 'its', 'with', 'for', 'on', 'at', 'by', 'to', 'from', 'their', 'they', 'them', 'we', 'our', 'me', 'my', 'your', 'worklet', 'worklets', 'give', 'tell', 'show', 'get', 'find', 'number', 'count']);

/**
 * Clean an extracted value by stripping trailing/leading field keywords.
 * e.g. "iot domain" → "iot", "communication network domain" → "communication network"
 *      "computer vision domain" → "computer vision", "status average" → "average"
 */
const cleanExtractedValue = (value: string): string => {
  let cleaned = value.trim();
  // Repeatedly strip field keywords from the start and end
  let changed = true;
  while (changed) {
    changed = false;
    for (const keyword of ALL_FIELD_KEYWORDS) {
      // Strip from end: "iot domain" → "iot"
      const trailingPattern = new RegExp(`\\s+${keyword}$`, 'i');
      if (trailingPattern.test(cleaned)) {
        cleaned = cleaned.replace(trailingPattern, '').trim();
        changed = true;
      }
      // Strip from start: "domain iot" → "iot"
      const leadingPattern = new RegExp(`^${keyword}\\s+`, 'i');
      if (leadingPattern.test(cleaned)) {
        cleaned = cleaned.replace(leadingPattern, '').trim();
        changed = true;
      }
      // If the entire value is just a field keyword, return empty
      if (cleaned.toLowerCase() === keyword) {
        return '';
      }
    }
  }
  return cleaned;
};

// ============================================================
// 1. Detect if a query is analytical (count/aggregation)
// ============================================================

export const isAnalyticalQuery = (query: string): boolean => {
  const lower = query.toLowerCase();

  // Patterns that indicate counting / aggregation
  const analyticalPatterns = [
    /how many/i,
    /count of/i,
    /total number/i,
    /total\s+worklets?/i,
    /number of/i,
    /how much/i,
    /\bhow\b.*\bworklets?\b/i,
    /give me the count/i,
    /breakdown/i,
    /distribution/i,
    /statistics/i,
    /stats\b/i,
    /summarize.*worklets?/i,
    /summary.*worklets?/i,
    /list all.*status/i,
    /list all.*stage/i,
    /list all.*domain/i,
    /list all.*college/i,
    /worklets? (with|having|in|at|from|under|whose)/i,
    /which worklets? have/i,
    /which worklets? are/i,
    /percentage of worklets/i,
    /what percentage/i,
    /show me.*worklet.*numbers/i,
    /what are the (different|various|unique)/i,
    /give.*exact number/i,
    /exact count/i,
  ];

  return analyticalPatterns.some(pattern => pattern.test(lower));
};

// ============================================================
// 2. Parse intent from the query
// ============================================================

interface ParsedIntent {
  type: 'count_filtered' | 'distribution' | 'total_count' | 'list_unique' | 'comparison' | 'unknown';
  field?: string;       // e.g., "status", "domain"
  value?: string;       // e.g., "average", "good"
  dbField?: string;     // actual MongoDB field name
}

export const parseAnalyticalIntent = (query: string): ParsedIntent => {
  const lower = query.toLowerCase().trim();
  // Remove trailing punctuation for cleaner matching
  const clean = lower.replace(/[?.!]+$/g, '').trim();

  console.log('📊 parseAnalyticalIntent input:', clean);

  // ------- DISTRIBUTION / BREAKDOWN -------
  if (/breakdown|distribution|statistic|stats\b|summarize|summary/i.test(clean)) {
    for (const [keyword, dbField] of Object.entries(QUERYABLE_FIELDS)) {
      if (clean.includes(keyword)) {
        return { type: 'distribution', field: keyword, dbField };
      }
    }
    return { type: 'distribution', field: 'status', dbField: 'status' };
  }

  // ------- LIST UNIQUE VALUES -------
  if (/what are the (different|various|unique)|list all|all (the )?unique|all (the )?(different|various)/i.test(clean)) {
    for (const [keyword, dbField] of Object.entries(QUERYABLE_FIELDS)) {
      if (clean.includes(keyword)) {
        return { type: 'list_unique', field: keyword, dbField };
      }
    }
  }

  // ------- Try to detect FIELD + VALUE from the query -------
  let detectedField: string | undefined;
  let detectedValue: string | undefined;
  let detectedDbField: string | undefined;

  // ===== PATTERN A: "VALUE as FIELD" (inverted) =====
  // e.g. "have IoT as domain", "have good as status", "IoT as their domain"
  for (const [keyword, dbField] of Object.entries(QUERYABLE_FIELDS)) {
    const invertedPatterns = [
      // "have IoT as domain", "with IoT as domain"
      new RegExp(`(?:have|with|having)\\s+["']?([\\w\\s&/-]+?)["']?\\s+(?:as|for)\\s+(?:their\\s+|the\\s+)?${keyword}`, 'i'),
      // "IoT as domain", "good as status"
      new RegExp(`["']?([\\w\\s&/-]+?)["']?\\s+(?:as|for)\\s+(?:their\\s+|the\\s+)?${keyword}`, 'i'),
    ];

    for (const pattern of invertedPatterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        const candidate = cleanExtractedValue(match[1]);
        if (candidate.length > 0 && !STOP_WORDS.has(candidate.toLowerCase())) {
          detectedField = keyword;
          detectedValue = candidate;
          detectedDbField = dbField;
          console.log(`📊 Pattern A matched: "${candidate}" as ${keyword}`);
          break;
        }
      }
    }
    if (detectedValue) break;
  }

  // ===== PATTERN B: "FIELD as/is/: VALUE" (normal) =====
  // e.g. "status as average", "domain is IoT", "status: good"
  if (!detectedValue) {
    for (const [keyword, dbField] of Object.entries(QUERYABLE_FIELDS)) {
      const normalPatterns = [
        new RegExp(`${keyword}\\s+(?:as|of|is|=|:|being)\\s+["']?([\\w\\s&/-]+?)["']?(?:\\s|$)`, 'i'),
        new RegExp(`(?:with|having|whose)\\s+${keyword}\\s+(?:as|of|is|=|:)?\\s*["']?([\\w\\s&/-]+?)["']?(?:\\s|$)`, 'i'),
        // "domain IoT" (field followed directly by value)
        new RegExp(`${keyword}\\s+["']?([\\w\\s&/-]+?)["']?(?:\\s|$)`, 'i'),
      ];

      for (const pattern of normalPatterns) {
        const match = clean.match(pattern);
        if (match && match[1]) {
          const candidate = cleanExtractedValue(match[1]);
          if (candidate.length > 0 && !STOP_WORDS.has(candidate.toLowerCase())) {
            detectedField = keyword;
            detectedValue = candidate;
            detectedDbField = dbField;
            console.log(`📊 Pattern B matched: ${keyword} = "${candidate}"`);
            break;
          }
        }
      }
      if (detectedValue) break;
    }
  }

  // ===== PATTERN C: "in/from/at VALUE FIELD" =====
  // e.g. "in IoT domain", "from VIT college", "at PSG institution"
  if (!detectedValue) {
    for (const [keyword, dbField] of Object.entries(QUERYABLE_FIELDS)) {
      // Only use keyword-aware pattern: "in <value> <keyword>"
      const pattern = new RegExp(`(?:in|from|at|under)\\s+(?:the\\s+)?["']?([\\w\\s&/-]+?)["']?\\s+${keyword}`, 'i');
      const match = clean.match(pattern);
      if (match && match[1]) {
        const candidate = cleanExtractedValue(match[1]);
        if (candidate.length > 0 && !STOP_WORDS.has(candidate.toLowerCase())) {
          detectedField = keyword;
          detectedValue = candidate;
          detectedDbField = dbField;
          console.log(`📊 Pattern C matched: ${keyword} = "${candidate}"`);
          break;
        }
      }
    }
  }

  // ===== PATTERN C2: "in/from/at VALUE" (no field keyword — guess from context) =====
  // e.g. "from VIT", "in AI"
  if (!detectedValue) {
    const prepMatch = clean.match(/(?:in|from|at|under)\s+(?:the\s+)?["']?([\w\s&/-]+?)["']?\s*$/i);
    if (prepMatch && prepMatch[1]) {
      const candidate = cleanExtractedValue(prepMatch[1]);
      if (candidate.length > 0 && !STOP_WORDS.has(candidate.toLowerCase())) {
        // Guess field from context
        if (/college|university|institute|iit|nit|vit|bits|psg|srm/i.test(clean)) {
          detectedField = 'college';
          detectedDbField = 'college';
        } else if (/domain|field|area|subject/i.test(clean)) {
          detectedField = 'domain';
          detectedDbField = 'domain';
        } else {
          // Auto-detect — will search all fields in executeAnalyticalQuery
          detectedField = 'auto';
          detectedDbField = 'auto';
        }
        detectedValue = candidate;
        console.log(`📊 Pattern C2 matched: ${detectedField} = "${candidate}"`);
      }
    }
  }

  // ===== PATTERN D: Known value without field keyword =====
  // e.g. "how many worklets are average", "count of good worklets"
  if (!detectedValue) {
    for (const status of KNOWN_STATUSES) {
      if (clean.includes(status)) {
        detectedField = 'status';
        detectedValue = status;
        detectedDbField = 'status';
        console.log(`📊 Pattern D (known status) matched: "${status}"`);
        break;
      }
    }
  }
  if (!detectedValue) {
    for (const stage of KNOWN_STAGES) {
      if (clean.includes(stage) && !KNOWN_STATUSES.includes(stage)) {
        detectedField = 'stage';
        detectedValue = stage;
        detectedDbField = 'stage';
        console.log(`📊 Pattern D (known stage) matched: "${stage}"`);
        break;
      }
    }
  }

  // ===== PATTERN E: Last resort — extract non-stop words and search all fields =====
  // e.g. "how many worklets have IoT" — no field keyword at all
  if (!detectedValue) {
    // Extract meaningful words (not stop words, not "worklet", not field keywords)
    const words = clean.split(/\s+/).filter(w => 
      !STOP_WORDS.has(w) && w.length > 1 && !ALL_FIELD_KEYWORDS.includes(w)
    );
    if (words.length > 0) {
      const candidate = cleanExtractedValue(words.join(' '));
      if (candidate.length > 0) {
        detectedValue = candidate;
        console.log(`📊 Pattern E (last resort) extracted candidate value: "${detectedValue}"`);
      }
    }
  }

  // ------- Return parsed result -------
  if (detectedField && detectedValue && detectedDbField) {
    return { type: 'count_filtered', field: detectedField, value: detectedValue, dbField: detectedDbField };
  }

  // If we have a value but no field, return as count_filtered with auto-detect marker
  if (detectedValue && !detectedField) {
    return { type: 'count_filtered', field: 'auto', value: detectedValue, dbField: 'auto' };
  }

  // ------- TRUE total count (only if no extra meaningful words) -------
  const meaningfulWords = clean.split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 1);
  if (meaningfulWords.length === 0) {
    return { type: 'total_count' };
  }

  // If we still can't parse, return unknown (will show full summary)
  return { type: 'unknown' };
};

// ============================================================
// 3. Execute the analytical query against MongoDB
// ============================================================

export const executeAnalyticalQuery = async (query: string): Promise<AnalyticalResult> => {
  try {
    console.log('📊 ===== ANALYTICAL QUERY ENGINE =====');
    console.log(`📊 Query: "${query}"`);

    if (!isAnalyticalQuery(query)) {
      return { isAnalytical: false, answer: '' };
    }

    const intent = parseAnalyticalIntent(query);
    console.log('📊 Parsed intent:', JSON.stringify(intent, null, 2));

    const totalWorklets = await Project.countDocuments();

    if (totalWorklets === 0) {
      return {
        isAnalytical: true,
        answer: 'There are currently no worklets in the database. Please upload worklet data first.',
        data: { total: 0 }
      };
    }

    switch (intent.type) {
      // ----- TOTAL COUNT -----
      case 'total_count': {
        return {
          isAnalytical: true,
          answer: `There are a total of **${totalWorklets}** worklets in the database.`,
          data: { total: totalWorklets }
        };
      }

      // ----- FILTERED COUNT -----
      case 'count_filtered': {
        let searchField = intent.dbField!;
        let displayField = intent.field!;
        const searchValue = intent.value!;

        // AUTO-DETECT: If field is 'auto', search across all fields to find the best match
        if (searchField === 'auto') {
          console.log(`📊 Auto-detecting field for value: "${searchValue}"`);
          const fieldsToSearch = ['status', 'stage', 'domain', 'college', 'mentors', 'students', 'professors'];
          let bestField = '';
          let bestCount = 0;

          for (const field of fieldsToSearch) {
            const filter: Record<string, any> = {};
            filter[field] = { $regex: new RegExp(searchValue, 'i') };
            const count = await Project.countDocuments(filter);
            console.log(`📊   ${field}: ${count} matches`);
            if (count > bestCount) {
              bestCount = count;
              bestField = field;
            }
          }

          if (bestField && bestCount > 0) {
            searchField = bestField;
            displayField = bestField;
            console.log(`📊 Auto-detected field: "${bestField}" with ${bestCount} matches`);
          } else {
            // No matches found in any field
            return {
              isAnalytical: true,
              answer: `No worklets found matching "**${searchValue}**" in any field (status, stage, domain, college, mentors, students, professors). There are **${totalWorklets}** total worklets in the database.\n\nTry asking for a breakdown, e.g., "Show me the domain distribution" or "What are the different statuses?"`,
              data: { count: 0, total: totalWorklets, searchValue }
            };
          }
        }

        const filter: Record<string, any> = {};
        filter[searchField] = { $regex: new RegExp(searchValue, 'i') };

        const count = await Project.countDocuments(filter);
        const percentage = ((count / totalWorklets) * 100).toFixed(1);

        // Also get a few sample worklet IDs for context
        const samples = await Project.find(filter)
          .select('workletId workletTitle')
          .limit(5)
          .lean();

        const sampleText = samples.length > 0
          ? `\n\nSome examples: ${samples.map(s => `Worklet ${s.workletId} (${s.workletTitle})`).join(', ')}${count > 5 ? `, and ${count - 5} more.` : '.'}`
          : '';

        // If count is 0, suggest alternatives
        if (count === 0) {
          // Get actual unique values for this field to suggest
          const uniqueVals = await Project.distinct(searchField);
          const suggestions = uniqueVals.slice(0, 10).map((v: any) => String(v)).join(', ');
          return {
            isAnalytical: true,
            answer: `No worklets found with ${displayField} matching "**${searchValue}**" out of ${totalWorklets} total worklets.\n\nAvailable ${displayField} values are: ${suggestions}`,
            data: { count: 0, total: totalWorklets, field: displayField, value: searchValue, availableValues: uniqueVals }
          };
        }

        return {
          isAnalytical: true,
          answer: `There are **${count}** worklets with ${displayField} matching "**${searchValue}**" out of ${totalWorklets} total worklets (**${percentage}%**).${sampleText}`,
          data: { count, total: totalWorklets, percentage: parseFloat(percentage), field: displayField, value: searchValue, samples }
        };
      }

      // ----- DISTRIBUTION / BREAKDOWN -----
      case 'distribution': {
        const pipeline = [
          { $group: { _id: `$${intent.dbField}`, count: { $sum: 1 } } },
          { $sort: { count: -1 as const } }
        ];

        const distribution = await Project.aggregate(pipeline);

        if (distribution.length === 0) {
          return {
            isAnalytical: true,
            answer: `No data found for ${intent.field} distribution.`,
            data: { distribution: [] }
          };
        }

        const lines = distribution.map((item, idx) => {
          const pct = ((item.count / totalWorklets) * 100).toFixed(1);
          return `  ${idx + 1}. **${item._id || 'Unknown'}**: ${item.count} worklets (${pct}%)`;
        });

        const answer = `Here's the **${intent.field} distribution** across ${totalWorklets} worklets:\n\n${lines.join('\n')}`;

        return {
          isAnalytical: true,
          answer,
          data: { distribution, total: totalWorklets }
        };
      }

      // ----- LIST UNIQUE VALUES -----
      case 'list_unique': {
        const uniqueValues = await Project.distinct(intent.dbField!);

        // For array fields (mentors, students, professors), flatten
        const flatValues = uniqueValues.flat().filter(Boolean);
        const unique = [...new Set(flatValues.map((v: any) => String(v).trim()))].sort();

        const answer = `There are **${unique.length}** unique ${intent.field} values:\n\n${unique.map((v, i) => `  ${i + 1}. ${v}`).join('\n')}`;

        return {
          isAnalytical: true,
          answer,
          data: { uniqueValues: unique, count: unique.length }
        };
      }

      // ----- UNKNOWN (could not parse but is analytical) -----
      case 'unknown': {
        // Return a helpful summary with all key stats
        const statusDist = await Project.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 as const } }
        ]);

        const stageDist = await Project.aggregate([
          { $group: { _id: '$stage', count: { $sum: 1 } } },
          { $sort: { count: -1 as const } }
        ]);

        const domainCount = (await Project.distinct('domain')).length;
        const collegeCount = (await Project.distinct('college')).length;

        const statusLines = statusDist.map(s => `  - **${s._id}**: ${s.count}`).join('\n');
        const stageLines = stageDist.map(s => `  - **${s._id}**: ${s.count}`).join('\n');

        const answer = `Here's an overview of all **${totalWorklets}** worklets:\n\n**Status Breakdown:**\n${statusLines}\n\n**Stage Breakdown:**\n${stageLines}\n\n**Other Stats:**\n  - Unique Domains: ${domainCount}\n  - Unique Colleges/Institutions: ${collegeCount}`;

        return {
          isAnalytical: true,
          answer,
          data: { total: totalWorklets, statusDist, stageDist, domainCount, collegeCount }
        };
      }

      default:
        return { isAnalytical: false, answer: '' };
    }
  } catch (error) {
    console.error('❌ Error in analytical query engine:', error);
    return {
      isAnalytical: true,
      answer: 'Sorry, I encountered an error while calculating the worklet statistics. Please try again.',
      data: { error: String(error) }
    };
  }
};
