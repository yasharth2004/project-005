# Testing Guide - Multi-Value Query Support

## Quick Start Testing

### 1. **Parse-Layer Unit Tests** (No Backend Required)
```bash
cd /Users/yasharthkesarwani/Downloads/project\ 005/backend
npx ts-node test-parse-layer.ts
```
**Expected Output:** 4 passed, 0 failed out of 4 tests

**What it tests:**
- Query parsing for multi-value domain queries
- Query parsing for multi-value college queries
- Query parsing for multi-value status queries (known values)
- Query parsing for multi-value status with comma separators

### 2. **Pattern Unit Tests** (No Backend Required)
```bash
cd backend
npx ts-node test-patterns-bc-c2.ts
```
**Expected Output:** 8 passed, 0 failed out of 8 tests

**What it tests:**
- Pattern A: "VALUE as FIELD" (inverted patterns)
- Pattern B: "FIELD is VALUE" (normal patterns)
- Pattern B: Multi-value college queries
- Pattern B: "have VALUE FIELD" syntax
- Pattern C: "in/from/at VALUE FIELD" patterns
- Pattern C: Multi-value college from pattern
- Pattern C: Multi-value status with commas
- Pattern C2: Context guessing for domains
- Pattern C2: Context guessing for colleges

## End-to-End Testing (Requires Backend)

### 1. **Start MongoDB**
```bash
# If MongoDB is installed locally
mongod
# or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 2. **Start Ollama** (for RAG features)
```bash
ollama serve
# In another terminal, pull the phi model:
ollama pull phi
```

### 3. **Start Backend**
```bash
cd backend
npm run dev
```
Should see: `✅ Server running on port 5000`

### 4. **Test via Chat Endpoint**

#### Test 1: Multi-Value Domain Query
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How many worklets have IoT and Computer Vision domain?",
    "userId": "test-user"
  }'
```
**Expected:** Returns count of worklets with either IoT OR Computer Vision domain

#### Test 2: Multi-Value College Query
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Count worklets from VIT and PSG college",
    "userId": "test-user"
  }'
```
**Expected:** Returns count of worklets from either VIT OR PSG college

#### Test 3: Multi-Value Status Query  
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How many worklets have good and bad status?",
    "userId": "test-user"
  }'
```
**Expected:** Returns count of worklets with either good OR bad status

#### Test 4: Three-Value Status Query
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me good, bad, and average status worklets",
    "userId": "test-user"
  }'
```
**Expected:** Returns count of worklets with good, bad, OR average status

### 5. **Test via Browser**
1. Start frontend: `cd /Users/yasharthkesarwani/Downloads/project\ 005 && npm run dev`
2. Open http://localhost:5173 (or shown port)
3. Login with admin credentials
4. Try these queries in the chat:
   - "How many worklets have IoT and Computer Vision domain?"
   - "Worklets from VIT and PSG college"
   - "How many worklets with good and bad status?"
   - "Show me good/bad/average status worklets"

## Expected Behavior

### Query Parsing
The system should:
1. ✅ Recognize compound values (separated by and/or/,/)
2. ✅ Extract all individual values into an array
3. ✅ Identify the field being queried (domain, college, status, etc.)
4. ✅ Set `multiValue: true` flag
5. ✅ Log multi-value detection

### Database Filtering
The system should:
1. ✅ Create MongoDB `$in` filter with regex patterns for each value
2. ✅ Return union of all matching documents (OR logic)
3. ✅ Show count of total matching worklets
4. ✅ Include sample worklet IDs in response

### Chat Response
The system should:
1. ✅ Recognize as analytical query (count filtered)
2. ✅ Return clear message with count
3. ✅ Mention the queried field and values
4. ✅ Provide percentage of total worklets
5. ✅ Show a few sample results

## Example Responses

### Input: "How many worklets have IoT and Computer Vision domain?"

**Bot Response:**
```
There are **45** worklets with **IoT** or **Computer Vision** domain (9% of total worklets).

Sample worklets:
- worklet-001: ML Pipeline Architecture
- worklet-002: Computer Vision System
- worklet-003: IoT Device Integration
```

### Input: "Count worklets from VIT and PSG college"

**Bot Response:**
```
Found **156** worklets from **VIT** or **PSG** college (31% of total worklets).

Sample worklets:
- wid-vit-101: Campus Automation
- wid-psg-202: Smart Grid System
- wid-vit-103: Data Analytics Platform
```

## Troubleshooting

### No Results Returned
- Check if the database has worklets with the queried values
- Verify MongoDB is running: `mongo` or check `mongosh`
- Check backend logs for SQL/query errors

### Wrong Field Detected
- The system uses context keywords to guess fields (e.g., "iot" → domain, "vit" → college)
- Try using explicit field names: "worklets with **[field] is** IoT and Computer Vision"
- Example: "worklets with domain is IoT and Computer Vision"

### Single Value Instead of Multi-Value
- Ensure values are separated by: `and`, `or`, `,`, or `/`
- Check backend logs for pattern matching debug output
- Verify the query doesn't have typos or unexpected keywords

### Timeout or Hanging Response
- Check if Ollama is running (required for RAG component)
- Monitor MongoDB performance
- Check system resources (CPU, memory)
- Review backend logs for errors

## Debugging Commands

### Check Parsing Only
```bash
cd backend
node -e "
const { parseAnalyticalIntent } = require('./src/services/analyticalQueryService');
const result = parseAnalyticalIntent('How many worklets have IoT and Computer Vision domain?');
console.log(JSON.stringify(result, null, 2));
"
```

### Check Backend Logs
```bash
# Terminal where backend is running:
# Look for:
# - "📊 Pattern B multi-value detected:"
# - "📊 Multi-value filter created for"
# - "📊 Executing filtered count:"
```

### Test Database Directly
```bash
mongosh localhost:27017/samsung-prism
> db.projects.find({ domain: { $in: [/iot/i, /computer vision/i] } }).count()
```

## Performance Considerations

### Single Database Field Query
- ~1-5ms for domain, college, status queries
- ~10-20ms for mentors/students/professors (array fields)

### Auto-Detect (Field: "auto")
- ~50-150ms for 2-3 values across 7 fields
- Scales with number of values and documents in database

### Optimization Tips
- Ensure MongoDB indexes on queryable fields: `status`, `stage`, `domain`, `college`
- Consider caching for frequently queried value combinations
- Monitor query performance: `db.setProfilingLevel(1)`

## Success Criteria

All of the following should be true:
- ✅ Parse-layer tests: 4/4 passing
- ✅ Pattern tests: 8/8 passing
- ✅ Chat endpoint returns correct counts for multi-value queries
- ✅ Frontend displays results correctly
- ✅ Response times < 500ms for typical queries
- ✅ Union logic works correctly (OR between values)
