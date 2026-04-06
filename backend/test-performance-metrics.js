const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const ITERATIONS = parseInt(process.env.METRICS_ITERATIONS || '20', 10);
const WARMUP = parseInt(process.env.METRICS_WARMUP || '3', 10);

const TEST_USER = {
  email: process.env.METRICS_USER_EMAIL || 'test@example.com',
  password: process.env.METRICS_USER_PASSWORD || 'password123'
};

const CHAT_QUERIES = [
  'What is Samsung PRISM program?',
  'What are the eligibility criteria for PRISM?',
  'How many worklets have status as average?',
  'How many worklets are in IoT domain?',
  'What is the status of worklet 001?'
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function summarizeLatency(values) {
  if (!values.length) {
    return {
      count: 0,
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0
    };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    minMs: Number(Math.min(...values).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2)),
    avgMs: Number((sum / values.length).toFixed(2)),
    p50Ms: Number(percentile(values, 50).toFixed(2)),
    p95Ms: Number(percentile(values, 95).toFixed(2)),
    p99Ms: Number(percentile(values, 99).toFixed(2))
  };
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function groundednessProxy(answer, sources) {
  if (!answer || !sources || !sources.length) return 0;
  const answerTokens = tokenize(answer);
  if (!answerTokens.length) return 0;

  const sourceText = sources.map(s => s.content || '').join(' ');
  const sourceSet = new Set(tokenize(sourceText));

  const overlap = answerTokens.filter(token => sourceSet.has(token)).length;
  return Number(((overlap / answerTokens.length) * 100).toFixed(2));
}

async function timedRequest(config) {
  const start = performance.now();
  const response = await axios(config);
  const end = performance.now();
  return { response, durationMs: end - start };
}

async function healthCheck() {
  const healthUrl = `${BASE_URL.replace('/api', '')}/api/health`;
  await axios.get(healthUrl, { timeout: 8000 });
}

async function authenticate() {
  const { response, durationMs } = await timedRequest({
    method: 'POST',
    url: `${BASE_URL}/auth/login`,
    data: TEST_USER,
    timeout: 15000
  });

  const token = response?.data?.data?.token;
  if (!token) {
    throw new Error('Auth token missing in login response');
  }

  return { token, durationMs };
}

async function benchmarkEndpoint(name, fn, iterations = ITERATIONS, warmup = WARMUP) {
  for (let i = 0; i < warmup; i++) {
    await fn(i, true);
  }

  const latencies = [];
  let success = 0;
  let failed = 0;

  const benchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    try {
      const { durationMs } = await fn(i, false);
      latencies.push(durationMs);
      success++;
    } catch (error) {
      failed++;
    }
  }
  const benchEnd = performance.now();

  const totalSec = (benchEnd - benchStart) / 1000;
  const throughputRps = totalSec > 0 ? Number((success / totalSec).toFixed(2)) : 0;

  return {
    name,
    success,
    failed,
    successRate: Number(((success / (success + failed || 1)) * 100).toFixed(2)),
    throughputRps,
    latency: summarizeLatency(latencies)
  };
}

async function main() {
  console.log('📊 Starting performance metrics run...');
  console.log(`➡️ Base URL: ${BASE_URL}`);
  console.log(`➡️ Iterations: ${ITERATIONS} (warmup: ${WARMUP})`);

  await healthCheck();
  const auth = await authenticate();
  const token = auth.token;

  console.log(`✅ Auth successful (${auth.durationMs.toFixed(2)} ms)`);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const metrics = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      iterations: ITERATIONS,
      warmup: WARMUP
    },
    endpoints: {},
    ragQuality: {}
  };

  metrics.endpoints.health = await benchmarkEndpoint('health', async () => {
    return timedRequest({
      method: 'GET',
      url: `${BASE_URL.replace('/api', '')}/api/health`,
      timeout: 8000
    });
  });

  metrics.endpoints.documentsSearch = await benchmarkEndpoint('documentsSearch', async () => {
    return timedRequest({
      method: 'GET',
      url: `${BASE_URL}/documents/search`,
      params: { q: 'PRISM', limit: 5 },
      headers,
      timeout: 15000
    });
  });

  const chatLatencies = [];
  const answerLengths = [];
  const sourceCounts = [];
  const topRelevance = [];
  const groundedness = [];
  let chatSuccess = 0;
  let chatFailed = 0;

  const chatStart = performance.now();

  for (let i = 0; i < WARMUP; i++) {
    const query = CHAT_QUERIES[i % CHAT_QUERIES.length];
    await timedRequest({
      method: 'POST',
      url: `${BASE_URL}/chat/generate`,
      headers,
      data: { query, limit: 5 },
      timeout: 70000
    });
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const query = CHAT_QUERIES[i % CHAT_QUERIES.length];
    try {
      const { response, durationMs } = await timedRequest({
        method: 'POST',
        url: `${BASE_URL}/chat/generate`,
        headers,
        data: { query, limit: 5 },
        timeout: 70000
      });

      const answer = response?.data?.data?.answer || '';
      const sources = response?.data?.data?.sources || [];

      chatLatencies.push(durationMs);
      answerLengths.push(answer.length);
      sourceCounts.push(sources.length);

      const top = sources.length ? Math.max(...sources.map(s => Number(s.relevanceScore || 0))) : 0;
      topRelevance.push(Number(top.toFixed(4)));

      groundedness.push(groundednessProxy(answer, sources));
      chatSuccess++;
    } catch (error) {
      chatFailed++;
    }
  }

  const chatEnd = performance.now();
  const chatSec = (chatEnd - chatStart) / 1000;

  metrics.endpoints.chatGenerate = {
    name: 'chatGenerate',
    success: chatSuccess,
    failed: chatFailed,
    successRate: Number(((chatSuccess / (chatSuccess + chatFailed || 1)) * 100).toFixed(2)),
    throughputRps: Number((chatSuccess / (chatSec || 1)).toFixed(2)),
    latency: summarizeLatency(chatLatencies)
  };

  const avg = arr => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0);

  metrics.ragQuality = {
    avgAnswerLengthChars: avg(answerLengths),
    avgSourcesPerAnswer: avg(sourceCounts),
    avgTopSourceRelevance: avg(topRelevance),
    avgGroundednessProxyPercent: avg(groundedness)
  };

  const outputPath = path.join(__dirname, 'performance-metrics-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));

  console.log('\n📈 PERFORMANCE METRICS SUMMARY');
  console.log('='.repeat(60));

  const printEndpoint = (ep) => {
    console.log(`\n🔹 ${ep.name}`);
    console.log(`   Success Rate: ${ep.successRate}% (${ep.success}/${ep.success + ep.failed})`);
    console.log(`   Throughput:   ${ep.throughputRps} req/s`);
    console.log(`   Avg Latency:  ${ep.latency.avgMs} ms`);
    console.log(`   P50/P95/P99:  ${ep.latency.p50Ms} / ${ep.latency.p95Ms} / ${ep.latency.p99Ms} ms`);
    console.log(`   Min/Max:      ${ep.latency.minMs} / ${ep.latency.maxMs} ms`);
  };

  printEndpoint(metrics.endpoints.health);
  printEndpoint(metrics.endpoints.documentsSearch);
  printEndpoint(metrics.endpoints.chatGenerate);

  console.log('\n🔹 RAG Quality Proxies');
  console.log(`   Avg Answer Length:        ${metrics.ragQuality.avgAnswerLengthChars} chars`);
  console.log(`   Avg Sources per Answer:   ${metrics.ragQuality.avgSourcesPerAnswer}`);
  console.log(`   Avg Top Source Relevance: ${metrics.ragQuality.avgTopSourceRelevance}`);
  console.log(`   Avg Groundedness Proxy:   ${metrics.ragQuality.avgGroundednessProxyPercent}%`);

  console.log(`\n💾 Full report saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error('❌ Metrics run failed:', error.response?.data || error.message || error);
  process.exit(1);
});
