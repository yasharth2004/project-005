// Debug regex patterns
const test1 = "how many worklets from srm with poor status";
const test2 = "how many worklets from vit with excellent status";

const hasMultipleFieldIndicators = /(?:from|in|at)\s+.*?(?:with|have|having)\s+/i;

console.log("Test 1:", test1);
console.log("  Regex matches:", hasMultipleFieldIndicators.test(test1));
console.log("  Match result:", test1.match(hasMultipleFieldIndicators));

console.log("\nTest 2:", test2);
console.log("  Regex matches:", hasMultipleFieldIndicators.test(test2));
console.log("  Match result:", test2.match(hasMultipleFieldIndicators));

// Test the split
const splitPattern = /^(.*?)\s+(?:with|have|having)\s+(.+)$/i;
console.log("\nSplit pattern test:");
console.log("Test 1 split:", test1.match(splitPattern));
console.log("Test 2 split:", test2.match(splitPattern));
