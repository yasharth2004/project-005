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
const KNOWN_STATUSES = ['excellent', 'very good', 'good', 'average', 'below average', 'poor', 'bad', 'active', 'completed', 'dropped', 'ongoing', 'review', 'inactive'];
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

/**
 * Extract multiple values from a query segment.
 * e.g., "good and bad" → ["good", "bad"]
 *       "good/bad/average" → ["good", "bad", "average"]
 *       "good or bad" → ["good", "bad"]
 *       "good, bad, and average" → ["good", "bad", "average"]
 */
const extractMultipleValues = (segment: string): string[] => {
  // Replace common separators with pipe for uniform splitting
  let normalized = segment
    .replace(/\s+and\s+/gi, '|')        // " and " → |
    .replace(/\s+or\s+/gi, '|')         // " or " → |
    .replace(/[/,]+/g, '|')             // / or , → |
    .split('|')
    .map(v => cleanExtractedValue(v.trim()))
    .filter(v => v.length > 0 && !STOP_WORDS.has(v.toLowerCase()));
  
  return normalized.length > 1 ? normalized : [];
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

interface Constraint {
  field: string;        // e.g., "status", "domain"
  dbField: string;      // actual MongoDB field name
  values: string[];     // e.g., ["poor", "average"]
  multiValue: boolean;  // true if multiple values in this constraint
}

interface ParsedIntent {
  type: 'count_filtered' | 'distribution' | 'total_count' | 'list_unique' | 'comparison' | 'unknown';
  field?: string;       // e.g., "status", "domain" (for backward compat - single field)
  value?: string;       // e.g., "average", "good" (for backward compat)
  values?: string[];    // e.g., ["good", "average"] for multi-value queries
  multiValue?: boolean; // true if multiple values were detected
  dbField?: string;     // actual MongoDB field name (for backward compat)
  constraints?: Constraint[]; // NEW: for compound multi-field queries
  isCompound?: boolean; // NEW: true if this is a compound query (multiple fields)
}

export const parseAnalyticalIntent = (query: string): ParsedIntent => {
  const lower = query.toLowerCase().trim();
  // Remove trailing punctuation for cleaner matching
  const clean = lower.replace(/[?.!]+$/g, '').trim();

  console.log('📊 parseAnalyticalIntent input:', clean);

  // ===== COMPOUND QUERY PREPROCESSING =====
  // If query contains " and " OR has multiple field indicators, try extracting multiple constraints
  // e.g., "from SRM and have status as poor" → ["from SRM", "have status as poor"]
  // e.g., "from VIT with poor status" → ["from VIT", "with poor status"]
  const constraints: Constraint[] = [];
  
  // Check for " and " OR "from/with/have" patterns that suggest multiple fields
  const hasAndSeparator = /\s+and\s+/i.test(clean);
  const hasMultipleFieldIndicators = /(?:from|in|at)\s+.*?(?:with|have|having)\s+/i.test(clean);
  
  if ((hasAndSeparator || hasMultipleFieldIndicators) && /(?:status|stage|domain|college|mentor|student|professor)/i.test(clean)) {
    console.log(`📊 Compound query candidate detected (and=${hasAndSeparator}, multi-indicators=${hasMultipleFieldIndicators})`);
    
    // Split by " and " OR identify boundaries between prep + "with/have"
    let segments: string[] = [];
    
    // ⚠️ PRIORITY: Check hasMultipleFieldIndicators FIRST
    // This prioritizes patterns like "from VIT have good and poor status"
    // where " and " connects values of the SAME field, not different fields
    if (hasMultipleFieldIndicators) {
      // Pattern: "from/in/at VALUE with/have VALUE FIELD"
      // Split after first "with" or "have" keyword
      const splitMatch = clean.match(/^(.*?)\s+(?:with|have|having)\s+(.+)$/i);
      if (splitMatch) {
        segments = [splitMatch[1], splitMatch[2]];
        console.log(`📊 Multi-field pattern detected (multi-indicators priority): ["${segments[0]}", "${segments[1]}"]`);
      }
    } else if (hasAndSeparator) {
      // Only split by " and " if NOT a multi-field pattern
      segments = clean.split(/\s+and\s+/);
      console.log(`📊 Multi-value same field: split by " and "`);
    }
    
    if (segments.length > 0) {
      console.log(`📊 Decomposed into ${segments.length} segments: ${JSON.stringify(segments)}`);

      // Known college patterns
      const collegeNames = /\b(vit|psg|srm|bits|iit|nit|kiit|jntu|anna|iitm|iitd|iitkgp|iitkbt|iitr|iitb|iitp|iithy|iitbhu|iitgn|iitmdr|iitph|iitgoa|manipal|amrita|christ|symbiosis|lovely|pdf|punjabi|delhi|jmi)\b/i;
      const domainKeywords = /\b(iot|ai|ml|blockchain|nlp|cloud|mobile|web|data|vision|automation|embedded|security|devops|cv|computer vision)\b/i;

      // For each segment, try to extract ONE field+value pair
      for (let idx = 0; idx < segments.length; idx++) {
        const segment = segments[idx].trim();
        console.log(`📊   Segment ${idx + 1}: "${segment}"`);

        let segmentDetectedField: string | undefined;
        let segmentDetectedValue: string | undefined;
        let segmentDetectedValues: string[] | undefined;  // NEW: track multiple values
        let segmentDetectedDbField: string | undefined;

        // First, check if this segment is about a known college or domain
        if (!segmentDetectedValue) {
          const collegeMatch = segment.match(collegeNames);
          if (collegeMatch && /(?:from|in|at|with|have|college|university|institution)/i.test(segment)) {
            segmentDetectedField = 'college';
            segmentDetectedValue = collegeMatch[1];
            segmentDetectedDbField = 'college';
            console.log(`📊     Recognized college: ${segmentDetectedValue}`);
          }

          // Check for known domains in this segment (collect ALL, not just first)
          if (!segmentDetectedValue && /(?:domain|have|with|technology|skill)/i.test(segment)) {
            const foundDomains: string[] = [];
            // Known domains list for multi-value detection (ORDERED: longest first for greedy matching)
            const knownDomainsList = [
              'computer vision', 'ondevice intelligence', 'communication network', 'language ai',
              'iot', 'ai', 'ml', 'blockchain', 'nlp', 'cloud', 'mobile', 'web', 'data', 'vision', 
              'automation', 'embedded', 'security', 'devops', 'cv'
            ];
            
            for (const domain of knownDomainsList) {
              // Use case-insensitive test that handles multi-word domains
              // For multi-word domains, escape spaces; for single-word, use word boundaries
              const isMultiWord = domain.includes(' ');
              const pattern = isMultiWord 
                ? new RegExp(domain, 'i')  // Multi-word: simple substring match
                : new RegExp(`\\b${domain}\\b`, 'i');  // Single-word: word boundary
              
              if (pattern.test(segment)) {
                foundDomains.push(domain);
              }
            }
            
            if (foundDomains.length > 0) {
              segmentDetectedField = 'domain';
              segmentDetectedValue = foundDomains[0];
              segmentDetectedValues = foundDomains;  // Store ALL domains found
              segmentDetectedDbField = 'domain';
              console.log(`📊     Recognized known domains: ${JSON.stringify(foundDomains)}`);
            }
          }
        }

        // Check for known statuses in this segment (collect ALL, not just first)
        if (!segmentDetectedValue) {
          const foundStatuses: string[] = [];
          for (const status of KNOWN_STATUSES) {
            if (new RegExp(`\\b${status}\\b`, 'i').test(segment)) {
              foundStatuses.push(status);
            }
          }
          if (foundStatuses.length > 0) {
            segmentDetectedField = 'status';
            segmentDetectedValue = foundStatuses[0];
            segmentDetectedValues = foundStatuses;
            segmentDetectedDbField = 'status';
            console.log(`📊     Recognized known statuses: ${JSON.stringify(foundStatuses)}`);
          }
        }

        // Check for known stages in this segment (collect ALL, not just first)
        if (!segmentDetectedValue) {
          const foundStages: string[] = [];
          for (const stage of KNOWN_STAGES) {
            if (new RegExp(`\\b${stage}\\b`, 'i').test(segment) && !KNOWN_STATUSES.includes(stage)) {
              foundStages.push(stage);
            }
          }
          if (foundStages.length > 0) {
            segmentDetectedField = 'stage';
            segmentDetectedValue = foundStages[0];
            segmentDetectedValues = foundStages;
            segmentDetectedDbField = 'stage';
            console.log(`📊     Recognized known stages: ${JSON.stringify(foundStages)}`);
          }
        }

        // Try each pattern on this segment if not already detected
        if (!segmentDetectedValue) {
          for (const [keyword, dbField] of Object.entries(QUERYABLE_FIELDS)) {
            // Pattern 1: "VALUE as FIELD"
            const p1 = new RegExp(`(?:have|with|having)\\s+["']?([\\w\\s&/-]+?)["']?\\s+(?:as|for)\\s+(?:their\\s+|the\\s+)?${keyword}`, 'i');
            let match = segment.match(p1);
            if (match && match[1]) {
              const candidate = cleanExtractedValue(match[1]);
              if (candidate && !STOP_WORDS.has(candidate.toLowerCase())) {
                segmentDetectedField = keyword;
                segmentDetectedValue = candidate;
                segmentDetectedDbField = dbField;
                // Check if candidate has multiple values (e.g., "good and poor")
                const multiVals = extractMultipleValues(candidate);
                if (multiVals.length > 0) {
                  segmentDetectedValues = multiVals;
                }
                console.log(`📊     Segment pattern 1 matched: ${keyword} = "${candidate}"${segmentDetectedValues ? ` (multi: ${JSON.stringify(segmentDetectedValues)})` : ''}`);
                break;
              }
            }

            // Pattern 2: "FIELD VALUE" or "FIELD as VALUE"
            if (!segmentDetectedValue) {
              const p2 = new RegExp(`${keyword}\\s+(?:as\\s+)?["']?([\\w\\s&/-]+?)["']?$`, 'i');
              match = segment.match(p2);
              if (match && match[1]) {
                const candidate = cleanExtractedValue(match[1]);
                if (candidate && !STOP_WORDS.has(candidate.toLowerCase())) {
                  segmentDetectedField = keyword;
                  segmentDetectedValue = candidate;
                  segmentDetectedDbField = dbField;
                  // Check if candidate has multiple values (e.g., "good and poor")
                  const multiVals = extractMultipleValues(candidate);
                  if (multiVals.length > 0) {
                    segmentDetectedValues = multiVals;
                  }
                  console.log(`📊     Segment pattern 2 matched: ${keyword} = "${candidate}"${segmentDetectedValues ? ` (multi: ${JSON.stringify(segmentDetectedValues)})` : ''}`);
                  break;
                }
              }
            }

            // Pattern 3: "from/at/in VALUE FIELD"
            if (!segmentDetectedValue) {
              const p3 = new RegExp(`(?:from|at|in|with)\\s+(?:the\\s+)?["']?([\\w\\s&/-]+?)["']?\\s+${keyword}`, 'i');
              match = segment.match(p3);
              if (match && match[1]) {
                const candidate = cleanExtractedValue(match[1]);
                if (candidate && !STOP_WORDS.has(candidate.toLowerCase())) {
                  segmentDetectedField = keyword;
                  segmentDetectedValue = candidate;
                  segmentDetectedDbField = dbField;
                  // Check if candidate has multiple values (e.g., "good and poor")
                  const multiVals = extractMultipleValues(candidate);
                  if (multiVals.length > 0) {
                    segmentDetectedValues = multiVals;
                  }
                  console.log(`📊     Segment pattern 3 matched: ${keyword} = "${candidate}"${segmentDetectedValues ? ` (multi: ${JSON.stringify(segmentDetectedValues)})` : ''}`);
                  break;
                }
              }
            }

            if (segmentDetectedValue) break;
          }
        }

        // If we found a constraint in this segment, add it
        if (segmentDetectedField && segmentDetectedValue && segmentDetectedDbField) {
          // If we already have multiple values (e.g., from known status/stage collection), use those
          let finalValues = segmentDetectedValues && segmentDetectedValues.length > 0 
            ? segmentDetectedValues 
            : [segmentDetectedValue];
          
          // Also check for multi-values within the value (e.g., "good and poor" in the segment)
          if (!segmentDetectedValues) {
            const multiVals = extractMultipleValues(segmentDetectedValue);
            finalValues = multiVals.length > 0 ? multiVals : [segmentDetectedValue];
          }
          
          constraints.push({
            field: segmentDetectedField,
            dbField: segmentDetectedDbField,
            values: finalValues,
            multiValue: finalValues.length > 1
          });
        }
      }
    }

    // If we found multiple constraints, check if they're for the SAME field
    // e.g., "from VIT and PSG college" → should be ONE constraint with multiValue=true
    if (constraints.length > 1) {
      // Group constraints by dbField
      const constraintsByField: Record<string, Constraint[]> = {};
      for (const constraint of constraints) {
        if (!constraintsByField[constraint.dbField]) {
          constraintsByField[constraint.dbField] = [];
        }
        constraintsByField[constraint.dbField].push(constraint);
      }

      // If all constraints are for the SAME field, combine them
      const fieldKeys = Object.keys(constraintsByField);
      if (fieldKeys.length === 1) {
        const singleFieldConstraints = constraintsByField[fieldKeys[0]];
        if (singleFieldConstraints.length > 1) {
          // Combine all values from all constraints into ONE
          const combinedValues: string[] = [];
          for (const constraint of singleFieldConstraints) {
            combinedValues.push(...constraint.values);
          }
          
          console.log(`📊 MULTI-VALUE QUERY DETECTED: Same field (${singleFieldConstraints[0].field}) with values: ${JSON.stringify(combinedValues)}`);
          
          return {
            type: 'count_filtered',
            field: singleFieldConstraints[0].field,
            value: combinedValues[0],
            values: combinedValues,
            multiValue: true,
            dbField: singleFieldConstraints[0].dbField
          };
        }
      }

      // If different fields, return as compound
      console.log(`📊 COMPOUND QUERY CONFIRMED: ${constraints.length} constraints found`);
      return {
        type: 'count_filtered',
        constraints: constraints,
        isCompound: true,
        // Fallback to first constraint for legacy compatibility
        field: constraints[0].field,
        value: constraints[0].values[0],
        values: constraints[0].values,
        multiValue: constraints[0].multiValue,
        dbField: constraints[0].dbField
      };
    }
  }

  // ------- If not compound or only one constraint found, proceed with regular single-field parsing -------
  // DISTRIBUTION / BREAKDOWN -------
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
  let detectedValues: string[] | undefined;

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
          
          // Check if candidate contains multiple values (and/or/,/)
          const multiVals = extractMultipleValues(match[1]);
          if (multiVals.length > 1) {
            detectedValues = multiVals;
            console.log(`📊 Pattern A multi-value detected: ${JSON.stringify(multiVals)}`);
          }
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
        // Capture everything after "is/as/etc" until question mark or end 
        new RegExp(`${keyword}\\s+(?:as|of|is|=|:|being)\\s+["']?([\\w\\s&,/-]+?)["']?(?:\\?|$)`, 'i'),
        new RegExp(`(?:with|having|whose)\\s+${keyword}\\s+(?:as|of|is|=|:)?\\s*["']?([\\w\\s&,/-]+?)["']?(?:\\?|$)`, 'i'),
        // "domain IoT" (field followed directly by value)
        new RegExp(`${keyword}\\s+["']?([\\w\\s&,/-]+?)["']?(?:\\?|$)`, 'i'),
        // "have ... VALUE FIELD" (e.g. "have IoT domain")
        new RegExp(`have\\s+["']?([\\w\\s&,/-]+?)["']?\\s+${keyword}(?:\\?|\\s|$)`, 'i'),
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
            
            // Check if candidate contains multiple values (and/or/,/)
            const multiVals = extractMultipleValues(match[1]);
            if (multiVals.length > 1) {
              detectedValues = multiVals;
              console.log(`📊 Pattern B multi-value detected: ${JSON.stringify(multiVals)}`);
            }
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
          
          // Check if candidate contains multiple values (and/or/,/)
          const multiVals = extractMultipleValues(match[1]);
          if (multiVals.length > 1) {
            detectedValues = multiVals;
            console.log(`📊 Pattern C multi-value detected: ${JSON.stringify(multiVals)}`);
          }
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
        } else if (/domain|field|area|subject|iot|ai|ml|vision|nlp|blockchain|cloud|mobile|web|data/i.test(clean)) {
          detectedField = 'domain';
          detectedDbField = 'domain';
        } else {
          // Auto-detect — will search all fields in executeAnalyticalQuery
          detectedField = 'auto';
          detectedDbField = 'auto';
        }
        detectedValue = candidate;
        console.log(`📊 Pattern C2 matched: ${detectedField} = "${candidate}"`);
        
        // Check if candidate contains multiple values (and/or/,/)
        const multiVals = extractMultipleValues(prepMatch[1]);
        if (multiVals.length > 1) {
          detectedValues = multiVals;
          console.log(`📊 Pattern C2 multi-value detected: ${JSON.stringify(multiVals)}`);
        }
      }
    }
  }

  // ===== PATTERN D: Known value without field keyword =====
  // e.g. "how many worklets are average", "count of good worklets"
  if (!detectedValue) {
    // First pass: collect ALL known statuses in the query
    const foundStatuses: string[] = [];
    for (const status of KNOWN_STATUSES) {
      if (new RegExp(`\\b${status}\\b`, 'i').test(clean)) {
        foundStatuses.push(status);
      }
    }
    
    if (foundStatuses.length >= 2) {
      // Multi-status query detected
      detectedField = 'status';
      detectedValue = foundStatuses[0];
      detectedDbField = 'status';
      detectedValues = foundStatuses;
      console.log(`📊 Pattern D (multi-status) matched: ${JSON.stringify(foundStatuses)}`);
    } else if (foundStatuses.length === 1) {
      // Single status query
      detectedField = 'status';
      detectedValue = foundStatuses[0];
      detectedDbField = 'status';
      console.log(`📊 Pattern D (known status) matched: "${foundStatuses[0]}"`);
    }
  }

  // Also check for multiple stages
  if (!detectedValue) {
    const foundStages: string[] = [];
    for (const stage of KNOWN_STAGES) {
      if (new RegExp(`\\b${stage}\\b`, 'i').test(clean) && !KNOWN_STATUSES.includes(stage)) {
        foundStages.push(stage);
      }
    }
    
    if (foundStages.length >= 2) {
      // Multi-stage query detected
      detectedField = 'stage';
      detectedValue = foundStages[0];
      detectedDbField = 'stage';
      detectedValues = foundStages;
      console.log(`📊 Pattern D (multi-stage) matched: ${JSON.stringify(foundStages)}`);
    } else if (foundStages.length === 1) {
      // Single stage query
      detectedField = 'stage';
      detectedValue = foundStages[0];
      detectedDbField = 'stage';
      console.log(`📊 Pattern D (known stage) matched: "${foundStages[0]}"`);
    }
  }

  // Also check for multiple domains
  if (!detectedValue) {
    const foundDomains: string[] = [];
    const knownDomainsList = [
      'computer vision', 'ondevice intelligence', 'communication network', 'language ai',
      'iot', 'ai', 'ml', 'blockchain', 'nlp', 'cloud', 'mobile', 'web', 'data', 'vision', 
      'automation', 'embedded', 'security', 'devops', 'cv'
    ];
    
    for (const domain of knownDomainsList) {
      // Use case-insensitive test that handles multi-word domains
      const isMultiWord = domain.includes(' ');
      const pattern = isMultiWord 
        ? new RegExp(domain, 'i')  // Multi-word: simple substring match
        : new RegExp(`\\b${domain}\\b`, 'i');  // Single-word: word boundary
      
      if (pattern.test(clean)) {
        foundDomains.push(domain);
      }
    }
    
    if (foundDomains.length >= 2) {
      // Multi-domain query detected
      detectedField = 'domain';
      detectedValue = foundDomains[0];
      detectedDbField = 'domain';
      detectedValues = foundDomains;
      console.log(`📊 Pattern D (multi-domain) matched: ${JSON.stringify(foundDomains)}`);
    } else if (foundDomains.length === 1) {
      // Single domain query
      detectedField = 'domain';
      detectedValue = foundDomains[0];
      detectedDbField = 'domain';
      console.log(`📊 Pattern D (known domain) matched: "${foundDomains[0]}"`);
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

  // ------- Check for multiple values before returning -------
  // e.g., "good and bad", "good/bad", "good, bad, and average"
  if (!detectedValues && detectedValue) {
    // If detectedValues weren't already set (e.g., by Pattern D), try to find more field values
    if (detectedField && detectedDbField) {
      let checkList: string[] = [];
      
      // Determine the check list based on detected field type
      if (detectedField === 'status') {
        checkList = KNOWN_STATUSES;
      } else if (detectedField === 'stage') {
        checkList = KNOWN_STAGES;
      } else if (detectedField === 'domain') {
        checkList = [
          'computer vision', 'ondevice intelligence', 'communication network', 'language ai',
          'iot', 'ai', 'ml', 'blockchain', 'nlp', 'cloud', 'mobile', 'web', 'data', 'vision', 
          'automation', 'embedded', 'security', 'devops', 'cv'
        ];
      }
      
      const foundVals: string[] = [];
      
      for (const val of checkList) {
        // For multi-word domains, use substring match; for single words, use word boundary
        const isMultiWord = val.includes(' ');
        const pattern = isMultiWord 
          ? new RegExp(val, 'i')  // Multi-word: simple substring match
          : new RegExp(`\\b${val}\\b`, 'i');  // Single-word: word boundary
        
        if (pattern.test(clean)) {
          foundVals.push(val);
        }
      }
      
      if (foundVals.length > 1) {
        detectedValues = foundVals;
        console.log(`📊 Multi-value detected from known list: ${JSON.stringify(foundVals)}`);
      }
    }
  }

  // ------- Check for compound queries (multiple field constraints) -------
  // Note: This is now handled upfront for " and " separated queries
  // This section only handles edge cases where constraints might be missed

  // ------- Return parsed result -------

  if (detectedField && detectedValue && detectedDbField) {
    const result: ParsedIntent = { 
      type: 'count_filtered', 
      field: detectedField, 
      value: detectedValue, 
      dbField: detectedDbField 
    };
    if (detectedValues && detectedValues.length > 1) {
      result.values = detectedValues;
      result.multiValue = true;
    }
    return result;
  }

  // If we have a value but no field, return as count_filtered with auto-detect marker
  if (detectedValue && !detectedField) {
    const result: ParsedIntent = { 
      type: 'count_filtered', 
      field: 'auto', 
      value: detectedValue, 
      dbField: 'auto' 
    };
    // For auto-detect, only use multi-values if they're clean and don't include stop words
    const cleanMulti = extractMultipleValues(detectedValue);
    if (cleanMulti.length > 1) {
      result.values = cleanMulti;
      result.multiValue = true;
    }
    return result;
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

      // ----- FILTERED COUNT (including multi-value) -----
      case 'count_filtered': {
        // ===== HANDLE COMPOUND QUERIES (Multiple Field Constraints) =====
        if (intent.isCompound && intent.constraints && intent.constraints.length > 1) {
          console.log(`📊 COMPOUND QUERY: Processing ${intent.constraints.length} constraints`);
          
          // Build $and filter combining all constraints
          const andConditions: Record<string, any>[] = [];
          const constraintDescriptions: string[] = [];

          for (const constraint of intent.constraints) {
            const field = constraint.dbField;
            let condition: Record<string, any> = {};

            if (constraint.multiValue && constraint.values.length > 1) {
              // Multiple values in this constraint → use $in with regex patterns
              const regexPatterns = constraint.values.map(v => new RegExp(`^${v}$|${v}`, 'i'));
              condition[field] = { $in: regexPatterns };
              constraintDescriptions.push(`${constraint.field} as **${constraint.values.join('**, **')}**`);
            } else {
              // Single value in this constraint
              condition[field] = { $regex: new RegExp(constraint.values[0], 'i') };
              constraintDescriptions.push(`${constraint.field} as **${constraint.values[0]}**`);
            }

            andConditions.push(condition);
          }

          // Build the compound filter
          const compoundFilter = { $and: andConditions };
          console.log(`📊 Compound filter: ${JSON.stringify(compoundFilter)}`);

          const count = await Project.countDocuments(compoundFilter);
          const percentage = ((count / totalWorklets) * 100).toFixed(1);

          // Get samples
          const samples = await Project.find(compoundFilter)
            .select('workletId workletTitle')
            .limit(5)
            .lean();

          const sampleText = samples.length > 0
            ? `\n\nSome examples: ${samples.map(s => `Worklet ${s.workletId} (${s.workletTitle})`).join(', ')}${count > 5 ? `, and ${count - 5} more.` : '.'}`
            : '';

          if (count === 0) {
            return {
              isAnalytical: true,
              answer: `No worklets found matching **${constraintDescriptions.join('** AND **')}** out of ${totalWorklets} total worklets.`,
              data: { count: 0, total: totalWorklets, constraints: intent.constraints }
            };
          }

          const answerMessage = `There are **${count}** worklets with ${constraintDescriptions.join(' AND ')} out of ${totalWorklets} total worklets (**${percentage}%**).${sampleText}`;
          return {
            isAnalytical: true,
            answer: answerMessage,
            data: { count, total: totalWorklets, percentage: parseFloat(percentage), constraints: intent.constraints, samples }
          };
        }

        // ===== SINGLE/MULTI-VALUE QUERIES (Original Logic) =====
        let searchField = intent.dbField!;
        let displayField = intent.field!;
        const searchValues = intent.multiValue && intent.values ? intent.values : [intent.value!];
        const isMutiValue = searchValues.length > 1;

        console.log(`📊 Executing filtered count: field=${searchField}, values=${JSON.stringify(searchValues)}, multiValue=${intent.multiValue}`);

        // AUTO-DETECT: If field is 'auto', search across all fields to find the best match
        if (searchField === 'auto') {
          console.log(`📊 Auto-detecting field for values: ${JSON.stringify(searchValues)}`);
          const fieldsToSearch = ['status', 'stage', 'domain', 'college', 'mentors', 'students', 'professors'];
          let bestField = '';
          let bestCount = 0;

          for (const field of fieldsToSearch) {
            // Create regex OR filter for all values
            const regexPatterns = searchValues.map(v => new RegExp(v, 'i'));
            const filter: Record<string, any> = {};
            filter[field] = { $in: regexPatterns };
            
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
              answer: `No worklets found matching ${isMutiValue ? `**${searchValues.join('**, **')}**` : `**${searchValues[0]}**`} in any field (status, stage, domain, college, mentors, students, professors). There are **${totalWorklets}** total worklets in the database.\n\nTry asking for a breakdown, e.g., "Show me the domain distribution" or "What are the different statuses?"`,
              data: { count: 0, total: totalWorklets, searchValues }
            };
          }
        }

        // Build filter for single or multiple values
        let filter: Record<string, any> = {};
        if (isMutiValue) {
          // Multi-value: use $in with regex patterns
          const regexPatterns = searchValues.map(v => new RegExp(`^${v}$|${v}`, 'i')); // exact or partial match
          filter[searchField] = { $in: regexPatterns };
          console.log(`📊 Multi-value filter created for ${JSON.stringify(searchValues)}`);
        } else {
          // Single value: keep original regex logic
          filter[searchField] = { $regex: new RegExp(searchValues[0], 'i') };
        }

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
          const valueStr = isMutiValue ? `${searchValues.join(', ')}` : searchValues[0];
          return {
            isAnalytical: true,
            answer: `No worklets found with ${displayField} matching "**${valueStr}**" out of ${totalWorklets} total worklets.\n\nAvailable ${displayField} values are: ${suggestions}`,
            data: { count: 0, total: totalWorklets, field: displayField, values: searchValues, availableValues: uniqueVals }
          };
        }

        // Build answer based on single or multi-value
        let answerMessage: string;
        if (isMutiValue) {
          const valueStr = searchValues.join('**, **');
          answerMessage = `There are **${count}** worklets with ${displayField} as **${valueStr}** out of ${totalWorklets} total worklets (**${percentage}%**).${sampleText}`;
        } else {
          answerMessage = `There are **${count}** worklets with ${displayField} matching "**${searchValues[0]}**" out of ${totalWorklets} total worklets (**${percentage}%**).${sampleText}`;
        }

        return {
          isAnalytical: true,
          answer: answerMessage,
          data: { count, total: totalWorklets, percentage: parseFloat(percentage), field: displayField, values: searchValues, samples }
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
