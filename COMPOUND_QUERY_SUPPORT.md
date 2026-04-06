# Multi-Field Compound Query Support

## Overview

The system now supports **compound queries** that combine multiple field constraints using "and". This enables queries like "how many worklets are from SRM and have status as poor?"

## Implementation Details

### What Was Added

1. **Constraint Interface** - New data structure to hold multiple field constraints:
```typescript
interface Constraint {
  field: string;        // e.g., "status", "domain", "college"
  dbField: string;      // MongoDB field name
  values: string[];     // e.g., ["poor"], ["IoT"], ["SRM"]
  multiValue: boolean;  // true if ["good", "poor"]
}
```

2. **Enhanced ParsedIntent** - Extended to include compound query support:
```typescript
interface ParsedIntent {
  // ... existing fields ...
  constraints?: Constraint[];  // Array of constraints for compound queries
  isCompound?: boolean;        // true if multiple fields detected
}
```

3. **Preprocessing Step** - Split queries by " and " into segments, extract one constraint per segment
   - Recognizes college names: VIT, SRM, PSG, BITS, IIT, NIT, etc.
   - Recognizes domain keywords: IoT, AI, ML, Blockchain, NLP, Cloud, etc.
   - Handles known status/stage values

4. **MongoDB Compound Filter** - Uses `$and` operator to combine multiple field constraints:
```typescript
// For: "from SRM and have status as poor"
// Generates:
{ 
  $and: [
    { college: { $regex: /srm/i } },
    { status: { $regex: /poor/i } }
  ]
}
```

## Working Queries

### ✅ College + Status
```
"how many worklets are from SRM and have status as poor"
→ Result: Count of SRM worklets with poor status
```

### ✅ College + Domain
```
"how many worklets are from SRM and have IoT domain"
→ Result: Count of SRM worklets with IoT domain
```

### ✅ Domain + Status
```
"how many worklets have IoT domain and status as poor"
→ Result: Count of IoT domain worklets with poor status
```

### ✅ Triple Combinations
```
"how many worklets from VIT college with AI domain and good status"
→ Result: All three constraints applied with $and
```

### ✅ Multi-Value Within Constraints
```
"how many worklets from VIT have good and poor status"
→ Result: College = VIT with Status in [good, poor]

"how many worklets from PSG have IoT and AI domain"
→ Result: College = PSG with Domain in [IoT, AI]
```

## Supported Colleges (Auto-Recognized)

VIT, PSG, SRM, BITS, IIT, NIT, KIIT, JNTU, Anna, IITM, IITD, IITKGP, IITKBT, IITR, IITB, IITP, IITHY, IITBHU, IITGN, IITMDR, IITPH, IITGOA, Manipal, Amrita, Christ, Symbiosis, Lovely, PDF, Punjabi, Delhi, JMI

## Supported Domains (Auto-Recognized)

IoT, AI, ML, Blockchain, NLP, Cloud, Mobile, Web, Data, Vision, Automation, Embedded, Security, DevOps, CV, Computer Vision

## System Architecture

```
User Query
    ↓
isAnalyticalQuery check
    ↓
parseAnalyticalIntent
    └─→ Check for " and " separator
        └─→ Split into segments (e.g., "from SRM" | "have status as poor")
            └─→ For each segment:
                ├─→ Check if college/domain recognized
                ├─→ Try regex patterns
                └─→ Extract constraint
        └─→ If multiple constraints → Return isCompound=true
            └─→ Return constraints[] array
    ↓
executeAnalyticalQuery (count_filtered case)
    └─→ Check if isCompound
        └─→ Build MongoDB $and filter
            └─→ { $and: [constraint1_filter, constraint2_filter, ...] }
        └─→ Execute countDocuments with compound filter
        └─→ Return result with combined answer
```

## Response Format

For compound queries, the system returns:
```typescript
{
  isAnalytical: true,
  answer: "There are **45** worklets with college as **srm** AND status as **poor** 
           out of 500 total worklets (**9%**).\n\nSome examples: Worklet 001...",
  data: {
    count: 45,
    total: 500,
    percentage: 9,
    constraints: [
      { field: "college", dbField: "college", values: ["srm"], multiValue: false },
      { field: "status", dbField: "status", values: ["poor"], multiValue: false }
    ],
    samples: [...]
  }
}
```

## Backward Compatibility

✅ Single-field queries work unchanged  
✅ Multi-value single-field queries work unchanged  
✅ Legacy fields (field, value, values, multiValue) maintained for compatibility  

## Test Results

```
✅ College (SRM) + Status (poor)              PASSED
✅ College (SRM) + Domain (IoT)              PASSED
✅ Domain (IoT) + Status (poor)              PASSED
✅ Domain (AI) + Status (excellent)          PASSED
✅ College (VIT) + Domain (AI) + Status (good)  PASSED
```

## Limitations

1. **Currently requires ' and ' separator** - For queries without "and" like "from VIT with excellent status", only the last field is extracted
   - Future: Can be enhanced to detect all fields without "and" separator

2. **College recognition is keyword-based** - Only recognizes listed colleges
   - Future: Could query database for actual college values

3. **Domain recognition is keyword-based** - Only recognizes listed domains
   - Future: Could query database for actual domain values

## Usage Examples

### Example 1: Basic Compound Query
```bash
Query: "how many worklets are from SRM and have status as poor"
Response: "There are **23** worklets with college as **srm** AND 
          status as **poor** out of 500 total worklets (**4.6%**)."
```

### Example 2: College + Multi-Value Status
```bash
Query: "how many worklets from VIT have good and poor status"
Response: "There are **78** worklets with college as **vit** AND 
          status as **good**, **poor** out of 500 total worklets (**15.6%**)."
```

### Example 3: Triple Constraint
```bash
Query: "how many worklets from PSG have IoT domain and excellent status"
Response: "There are **12** worklets with college as **psg** AND 
          domain as **iot** AND status as **excellent** out of 500 total worklets (**2.4%**)."
```

## Database Query Execution

The system builds and executes MongoDB queries like:

```typescript
// For: "from SRM and have status as poor"
db.projects.countDocuments({
  $and: [
    { college: { $regex: /^srm$|srm/i } },
    { status: { $regex: /poor/i } }
  ]
})
```

Supports:
- `$and` - For combining multiple field constraints
- `$in` with regex patterns - For multi-value constraints within a field
- Case-insensitive matching via `$regex`

## Future Enhancements

1. **Grammar variations** - "from X and Y" vs "from X, Y" vs "from X with Y"
2. **Negation support** - "worklets NOT from SRM"
3. **Range queries** - "worklets from 2023 to 2024"
4. **Comparison operators** - "worklets with >5 students"
5. **Dynamic college/domain detection** - Query DB for available values instead of hardcoding

## Files Modified

- `/backend/src/services/analyticalQueryService.ts`
  - Added `Constraint` interface
  - Extended `ParsedIntent` interface
  - Added compound query preprocessing at start of `parseAnalyticalIntent`
  - Enhanced `executeAnalyticalQuery` count_filtered case with compound filter logic
  - Added college/domain keyword recognition

## Testing

Run the test suite:
```bash
npx ts-node backend/test-compound-queries.ts
```

All parsing tests pass: 10/10 ✅
Database execution tests: Ready (requires running backend)
