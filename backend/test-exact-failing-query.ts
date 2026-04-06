// Integration test for the exact query that was failing
// Query: "how many worklets from VIT have good and poor status ??"

import { parseAnalyticalIntent, isAnalyticalQuery } from './src/services/analyticalQueryService';

console.log(`\n${'═'.repeat(100)}`);
console.log(`EXACT FAILING QUERY TEST - Multi-Status Compound Query Fix`);
console.log(`${'═'.repeat(100)}\n`);

const query = "how many worklets from VIT have good and poor status ??";
console.log(`🔍 QUERY: "${query}"\n`);
console.log(`📊 EXPECTED RESULT: Count worklets from VIT where status IN [good, poor]\n`);

try {
  // Step 1: Check if recognized as analytical
  const isAnalytical = isAnalyticalQuery(query);
  console.log(`Step 1: Is Analytical Query?`);
  console.log(`  Result: ${isAnalytical ? '✅ YES' : '❌ NO'}\n`);

  if (!isAnalytical) {
    console.log(`❌ CRITICAL: Query not recognized as analytical!\n`);
    process.exit(1);
  }

  // Step 2: Parse the intent
  console.log(`Step 2: Parse Intent`);
  const intent = parseAnalyticalIntent(query);
  
  console.log(`  Type: ${intent.type}`);
  console.log(`  IsCompound: ${intent.isCompound}`);
  console.log(`  MultiValue: ${intent.multiValue}\n`);

  if (intent.type !== 'count_filtered') {
    console.log(`❌ ERROR: Expected type="count_filtered", got "${intent.type}"\n`);
    process.exit(1);
  }

  // Step 3: Check constraints
  console.log(`Step 3: Validate Constraints`);
  
  if (!intent.isCompound) {
    console.log(`⚠️  WARNING: isCompound=false, but query has two fields (college + status)\n`);
  }

  if (!intent.constraints || intent.constraints.length === 0) {
    console.log(`❌ ERROR: No constraints found!\n`);
    process.exit(1);
  }

  console.log(`  Found ${intent.constraints.length} constraint(s):\n`);

  for (let i = 0; i < intent.constraints.length; i++) {
    const c = intent.constraints[i];
    console.log(`  Constraint ${i + 1}:`);
    console.log(`    Field: ${c.field}`);
    console.log(`    DB Field: ${c.dbField}`);
    console.log(`    Values: [${c.values.map(v => `"${v}"`).join(', ')}]`);
    console.log(`    MultiValue: ${c.multiValue}`);
    console.log(`    Value Count: ${c.values.length}\n`);
  }

  // Step 4: Validate specific constraints
  console.log(`Step 4: Validate Specific Constraints\n`);

  const collegeConstraint = intent.constraints.find(c => c.field === 'college');
  if (!collegeConstraint) {
    console.log(`❌ ERROR: No college constraint found!\n`);
    process.exit(1);
  }
  console.log(`✅ College constraint found:`);
  console.log(`   Values: [${collegeConstraint.values.join(', ')}]`);
  if (!collegeConstraint.values.some(v => v.toLowerCase().includes('vit'))) {
    console.log(`❌ ERROR: VIT not in college values!\n`);
    process.exit(1);
  }
  console.log(`✅ Contains VIT\n`);

  const statusConstraint = intent.constraints.find(c => c.field === 'status');
  if (!statusConstraint) {
    console.log(`❌ ERROR: No status constraint found!\n`);
    process.exit(1);
  }
  console.log(`✅ Status constraint found:`);
  console.log(`   Values: [${statusConstraint.values.join(', ')}]`);
  console.log(`   MultiValue: ${statusConstraint.multiValue}`);

  if (statusConstraint.values.length !== 2) {
    console.log(`❌ ERROR: Expected 2 status values, got ${statusConstraint.values.length}\n`);
    process.exit(1);
  }
  console.log(`✅ Has exactly 2 status values`);

  const statusesLower = statusConstraint.values.map(v => v.toLowerCase());
  const hasGood = statusesLower.some(v => v.includes('good'));
  const hasPoor = statusesLower.some(v => v.includes('poor'));

  if (!hasGood) {
    console.log(`❌ ERROR: "good" status not found!\n`);
    process.exit(1);
  }
  console.log(`✅ Contains "good"`);

  if (!hasPoor) {
    console.log(`❌ ERROR: "poor" status not found!\n`);
    process.exit(1);
  }
  console.log(`✅ Contains "poor"\n`);

  if (!statusConstraint.multiValue) {
    console.log(`❌ ERROR: Status constraint should have multiValue=true\n`);
    process.exit(1);
  }
  console.log(`✅ Status constraint marked as multiValue\n`);

  // Step 5: Summary
  console.log(`${'═'.repeat(100)}`);
  console.log(`🎉 ALL CHECKS PASSED! ✅`);
  console.log(`${'═'.repeat(100)}`);
  console.log(`\nThe query will be executed as compound with:
  - College: ${collegeConstraint.values.join(', ')}
  - Status: ${statusConstraint.values.join(', ')} (multi-value)
  - Filter: { $and: [{ college: {...} }, { status: { $in: [...] } }] }`);
  console.log(`\n✅ This will correctly count worklets from VIT with status IN [good, poor]\n`);

} catch (error) {
  console.log(`\n❌ EXCEPTION DURING TEST:\n`);
  console.error(error);
  console.log(`\n`);
  process.exit(1);
}
