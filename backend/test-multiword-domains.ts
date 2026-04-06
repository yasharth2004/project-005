// Test for multi-word domain detection in compound queries
// Issue: "How many worklets from SRM have domains as IOT and Ondevice Intelligence ??"
// Expected: Both IOT and Ondevice Intelligence detected
// Actual (Before Fix): Only IOT detected (multi-word domain wasn't recognized)

import { parseAnalyticalIntent, isAnalyticalQuery } from './src/services/analyticalQueryService';

console.log(`\n${'═'.repeat(100)}`);
console.log(`MULTI-WORD DOMAIN DETECTION TEST - Ondevice Intelligence, Communication Network, Language AI`);
console.log(`${'═'.repeat(100)}\n`);

const testCases = [
  {
    query: "How many worklets are from SRM and have domains as IOT and Ondevice Intelligence ??",
    expectedDomains: ['iot', 'ondevice intelligence'],
    description: "Multi-word domain 'Ondevice Intelligence' with IOT"
  },
  {
    query: "How many worklets are from SRM and have domains as IOT and Communication network ??",
    expectedDomains: ['iot', 'communication network'],
    description: "Multi-word domain 'Communication network' with IOT"
  },
  {
    query: "How many worklets are from SRM and have domains as IOT and Language AI ??",
    expectedDomains: ['iot', 'language ai'],
    description: "Multi-word domain 'Language AI' with IOT"
  },
  {
    query: "How many worklets have Computer Vision and Language AI domains",
    expectedDomains: ['computer vision', 'language ai'],
    description: "Two multi-word domains without college field"
  },
  {
    query: "from BITS with IoT and Ondevice Intelligence domain",
    expectedDomains: ['iot', 'ondevice intelligence'],
    description: "Multi-word domain with single-word domain using 'with'"
  }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\n📋 TEST: ${testCase.description}`);
  console.log(`➤ Query: "${testCase.query}"`);
  
  try {
    const isAnalytical = isAnalyticalQuery(testCase.query);
    if (!isAnalytical) {
      console.log(`❌ FAILED: Query not recognized as analytical`);
      failed++;
      continue;
    }

    const intent = parseAnalyticalIntent(testCase.query);
    
    let testPassed = true;
    const failures: string[] = [];

    // Check if compound or multi-value
    if (intent.isCompound && intent.constraints) {
      // Compound query - find domain constraint
      const domainConstraint = intent.constraints.find(c => c.field === 'domain');
      if (!domainConstraint) {
        failures.push(`Expected domain constraint in compound query`);
        testPassed = false;
      } else {
        const domainsLower = domainConstraint.values.map(v => v.toLowerCase());
        
        for (const expectedDomain of testCase.expectedDomains) {
          const found = domainsLower.some(v => 
            v.toLowerCase() === expectedDomain.toLowerCase() || 
            v.toLowerCase().includes(expectedDomain.toLowerCase())
          );
          if (!found) {
            failures.push(`Expected domain "${expectedDomain}" not found in [${domainsLower.join(', ')}]`);
            testPassed = false;
          }
        }
        
        if (domainConstraint.values.length !== testCase.expectedDomains.length) {
          failures.push(`Expected ${testCase.expectedDomains.length} domains, got ${domainConstraint.values.length}: [${domainConstraint.values.join(', ')}]`);
          testPassed = false;
        }
        
        if (!domainConstraint.multiValue && testCase.expectedDomains.length > 1) {
          failures.push(`Domain constraint should have multiValue=true`);
          testPassed = false;
        }
      }
    } else {
      // Single field multi-value query
      if (!intent.multiValue && testCase.expectedDomains.length > 1) {
        failures.push(`Expected multiValue=true`);
        testPassed = false;
      }
      
      if (!intent.field?.includes('domain')) {
        failures.push(`Expected domain field, got ${intent.field}`);
        testPassed = false;
      }
      
      if (intent.values) {
        const valuesLower = intent.values.map(v => v.toLowerCase());
        
        for (const expectedDomain of testCase.expectedDomains) {
          const found = valuesLower.some(v => 
            v.toLowerCase() === expectedDomain.toLowerCase() || 
            v.toLowerCase().includes(expectedDomain.toLowerCase())
          );
          if (!found) {
            failures.push(`Expected domain "${expectedDomain}" not found in [${valuesLower.join(', ')}]`);
            testPassed = false;
          }
        }
        
        if (intent.values.length !== testCase.expectedDomains.length) {
          failures.push(`Expected ${testCase.expectedDomains.length} domains, got ${intent.values.length}: [${intent.values.join(', ')}]`);
          testPassed = false;
        }
      } else {
        failures.push(`No values found for domain field`);
        testPassed = false;
      }
    }

    if (testPassed) {
      console.log(`✅ PASSED`);
      if (intent.isCompound && intent.constraints) {
        const domainConstraint = intent.constraints.find(c => c.field === 'domain');
        if (domainConstraint) {
          console.log(`   Domains: [${domainConstraint.values.join(', ')}] (multi-value)`);
        }
      } else if (intent.values) {
        console.log(`   Domains: [${intent.values.join(', ')}] (multi-value)`);
      }
      passed++;
    } else {
      console.log(`❌ FAILED:`);
      for (const failure of failures) {
        console.log(`   - ${failure}`);
      }
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${(error as Error).message}`);
    console.error(error);
    failed++;
  }
}

console.log(`\n${'═'.repeat(100)}`);
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`${'═'.repeat(100)}\n`);

process.exit(failed > 0 ? 1 : 0);
