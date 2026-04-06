/**
 * Test script for Pattern B, C, C2 multi-value enhancements
 * Tests multi-value extraction for domain, college, and other fields
 */

import { parseAnalyticalIntent } from './src/services/analyticalQueryService';

// Test cases for Pattern B (FIELD is VALUE)
const patternBTests = [
  {
    query: 'How many worklets have domain is IoT and Computer Vision?',
    expectedField: 'domain',
    expectedValues: ['IoT', 'Computer Vision'],
    description: 'Pattern B: domain is IoT and Computer Vision'
  },
  {
    query: 'worklets with status as good and bad',
    expectedField: 'status',
    expectedValues: ['good', 'bad'],
    description: 'Pattern B: status as good and bad'
  },
  {
    query: 'worklets college is VIT and PSG',
    expectedField: 'college',
    expectedValues: ['VIT', 'PSG'],
    description: 'Pattern B: college is VIT and PSG'
  },
];

// Test cases for Pattern C (in/from VALUE FIELD)
const patternCTests = [
  {
    query: 'How many worklets are in IoT and Computer Vision domain?',
    expectedField: 'domain',
    expectedValues: ['IoT', 'Computer Vision'],
    description: 'Pattern C: in IoT and Computer Vision domain'
  },
  {
    query: 'worklets from VIT and PSG college',
    expectedField: 'college',
    expectedValues: ['VIT', 'PSG'],
    description: 'Pattern C: from VIT and PSG college'
  },
  {
    query: 'at good, bad, and average status',
    expectedField: 'status',
    expectedValues: ['good', 'bad', 'average'],
    description: 'Pattern C: at good, bad, and average status'
  },
];

// Test cases for Pattern C2 (in/from VALUE with context guessing)
const patternC2Tests = [
  {
    query: 'How many worklets from IoT and Computer Vision?',
    expectedField: 'domain',
    expectedValues: ['IoT', 'Computer Vision'],
    description: 'Pattern C2: from IoT and Computer Vision (domain context)'
  },
  {
    query: 'worklets from VIT and PSG',
    expectedField: 'college',
    expectedValues: ['VIT', 'PSG'],
    description: 'Pattern C2: from VIT and PSG (college context)'
  },
];

async function runTests() {
  console.log('🧪 Testing Pattern B, C, C2 Multi-Value Support\n');

  const allTests = [
    ...patternBTests.map(t => ({ ...t, pattern: 'B' })),
    ...patternCTests.map(t => ({ ...t, pattern: 'C' })),
    ...patternC2Tests.map(t => ({ ...t, pattern: 'C2' })),
  ];

  let passed = 0;
  let failed = 0;

  for (const test of allTests) {
    try {
      const result = parseAnalyticalIntent(test.query);
      console.log(`\n📋 Test: ${test.description}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Detected Field: ${result.field}`);
      console.log(`   Detected Value: ${result.value}`);
      console.log(`   Detected Values: ${JSON.stringify(result.values || [])}`);

      // Check if multi-values were detected
      const hasMultiValues = result.values && result.values.length > 1;
      
      if (hasMultiValues && result.field === test.expectedField) {
        // Verify values match (case-insensitive)
        const detectedLower = result.values!.map((v: string) => v.toLowerCase());
        const expectedLower = test.expectedValues.map(v => v.toLowerCase());
        const allMatch = expectedLower.every(v => detectedLower.includes(v));
        
        if (allMatch) {
          console.log(`   ✅ PASS`);
          passed++;
        } else {
          console.log(`   ❌ FAIL: Values don't match. Expected ${JSON.stringify(test.expectedValues)}`);
          failed++;
        }
      } else if (hasMultiValues) {
        console.log(`   ⚠️  PARTIAL: Multi-values detected but field mismatch. Expected field: ${test.expectedField}, Got: ${result.field}`);
        failed++;
      } else {
        console.log(`   ❌ FAIL: No multi-values detected`);
        failed++;
      }
    } catch (err) {
      console.log(`\n❌ Test failed: ${test.description}`);
      console.log(`   Error: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n\n📊 Summary: ${passed} passed, ${failed} failed out of ${allTests.length} tests`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
