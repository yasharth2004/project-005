/**
 * Unit test for multi-value parsing specifically
 */

import { parseAnalyticalIntent } from './src/services/analyticalQueryService';

interface TestCase {
  query: string;
  expectedType: string;
  expectedField?: string;
  expectedValues?: string[];
  description: string;
}

const tests: TestCase[] = [
  // QUERY TYPE DETECTION
  {
    query: 'How many worklets have IoT and Computer Vision domain?',
    description: 'Should be count_filtered',
    expectedType: 'count_filtered',
    expectedField: 'domain',
    expectedValues: ['iot', 'computer vision']
  },
  {
    query: 'Count worklets from VIT and PSG college',
    description: 'Should be count_filtered',
    expectedType: 'count_filtered',
    expectedField: 'college',
    expectedValues: ['vit', 'psg']
  },
  // EXISTING STATUS/STAGE QUERIES  
  {
    query: 'How many worklets have good and bad status?',
    description: 'Multi-value status with known values',
    expectedType: 'count_filtered',
    expectedField: 'status',
    expectedValues: ['good', 'bad']
  },
  {
    query: 'Count worklets with good, bad, or average status',
    description: 'Three status values',
    expectedType: 'count_filtered',
    expectedField: 'status',
    expectedValues: ['good', 'bad', 'average']
  },
];

async function runTests() {
  console.log('🧪 Unit Test: Multi-Value Query Parsing\n');
  
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const  result = parseAnalyticalIntent(test.query);
      
      console.log(`\n📋 ${test.description}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Parsed Type: ${result.type}`);
      console.log(`   Parsed Field: ${result.field}`);
      console.log(`   Parsed Values: ${JSON.stringify(result.values || [])}`);
      
      let success = true;
      
      // Check type
      if (result.type !== test.expectedType) {
        console.log(`   ❌ Type mismatch: expected ${test.expectedType}, got ${result.type}`);
        success = false;
      }
      
      // Check field (if specified)
      if (test.expectedField && result.field !== test.expectedField) {
        console.log(`   ❌ Field mismatch: expected ${test.expectedField}, got ${result.field}`);
        success = false;
      }
      
      // Check values (if specified)
      if (test.expectedValues && result.values) {
        const resultLower = result.values.map(v => v.toLowerCase()).sort();
        const expectedLower = test.expectedValues.map(v => v.toLowerCase()).sort();
        const match = JSON.stringify(resultLower) === JSON.stringify(expectedLower);
        if (!match) {
          console.log(`   ❌ Values mismatch: expected ${JSON.stringify(expectedLower)}, got ${JSON.stringify(resultLower)}`);
          success = false;
        }
      }
      
      if (success) {
        console.log(`   ✅ PASS`);
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.log(`\n❌ Test failed: ${test.description}`);
      console.log(`   Error: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n\n📊 Parse-Layer Summary: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
