const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const DATASET_PATH = process.env.METRICS_DATASET || path.join(__dirname, 'metrics-benchmark-dataset.json');
const K = parseInt(process.env.METRICS_TOP_K || '5', 10);

const TEST_USER = {
  email: process.env.METRICS_USER_EMAIL || 'test@example.com',
  password: process.env.METRICS_USER_PASSWORD || 'password123'
};

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function groundednessProxy(answer, sources) {
  if (!answer || !sources?.length) return 0;
  const answerTokens = tokenize(answer);
  if (!answerTokens.length) return 0;

  const sourceSet = new Set(tokenize(sources.map(s => s.content || '').join(' ')));
  const overlap = answerTokens.filter(t => sourceSet.has(t)).length;
  return overlap / answerTokens.length;
}

function keywordCoverage(answer, expectedKeywords = []) {
  if (!expectedKeywords.length) return null;
  const answerLower = answer.toLowerCase();
  const answerTokens = new Set(tokenize(answer));
  const matched = expectedKeywords.map(k => k.toLowerCase()).filter(k => {
    // exact token match
    if (answerTokens.has(k)) return true;
    // substring match (handles stems: "eligible" matches "eligibility", "234" matches "234 worklets")
    if (answerLower.includes(k)) return true;
    // numeric match: if keyword is a number, check if it appears anywhere in the answer
    if (/^\d+$/.test(k) && answerLower.includes(k)) return true;
    return false;
  }).length;
  return matched / expectedKeywords.length;
}

function sourceMatchesHint(sourceName, hint) {
  return sourceName.toLowerCase().includes(hint.toLowerCase());
}

function evaluateRetrieval(sources, expectedHints, k) {
  if (!expectedHints || expectedHints.length === 0) {
    return {
      precisionAtK: null,
      recallAtK: null,
      mrr: null,
      ndcgAtK: null,
      relevantRetrieved: null,
      firstRelevantRank: null
    };
  }

  const top = (sources || []).slice(0, k);

  // Binary relevance per position: 1 if source matches ANY hint
  const relevance = top.map(src => expectedHints.some(h => sourceMatchesHint(src.fileName || '', h)) ? 1 : 0);
  const sourcesMatchingHint = relevance.reduce((a, b) => a + b, 0);

  // Precision@K: fraction of top-K that are relevant
  const precisionAtK = top.length > 0 ? sourcesMatchingHint / top.length : 0;

  // Recall@K: fraction of HINTS for which at least one matching source was retrieved
  // (treats each hint as one ground-truth item to recover)
  const hintsFound = expectedHints.filter(h =>
    top.some(src => sourceMatchesHint(src.fileName || '', h))
  ).length;
  const recallAtK = expectedHints.length > 0 ? hintsFound / expectedHints.length : 0;

  // MRR: reciprocal of first relevant rank
  let firstRelevantRank = null;
  for (let i = 0; i < relevance.length; i++) {
    if (relevance[i] > 0) { firstRelevantRank = i + 1; break; }
  }
  const mrr = firstRelevantRank ? 1 / firstRelevantRank : 0;

  // nDCG@K: standard binary relevance, capped so IDCG = ideal for expectedHints.length items
  const dcg = relevance.reduce((sum, rel, idx) => sum + (rel / Math.log2(idx + 2)), 0);
  const idealCount = Math.min(expectedHints.length, k, top.length);
  const idcg = Array.from({ length: idealCount }).reduce((sum, _, idx) => sum + (1 / Math.log2(idx + 2)), 0);
  const ndcgAtK = idcg > 0 ? Math.min(1, dcg / idcg) : 0; // cap at 1 to stay in [0,1]

  return { precisionAtK, recallAtK, mrr, ndcgAtK, relevantRetrieved: sourcesMatchingHint, firstRelevantRank };
}

async function authenticate() {
  const start = performance.now();
  const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER, { timeout: 15000 });
  const end = performance.now();

  const token = response?.data?.data?.token;
  if (!token) throw new Error('Auth token missing');
  return { token, authLatencyMs: end - start };
}

async function run() {
  console.log('🎯 Running RAG accuracy/precision metrics...');
  console.log(`➡️ Dataset: ${DATASET_PATH}`);
  console.log(`➡️ Top-K: ${K}`);

  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const { token, authLatencyMs } = await authenticate();
  console.log(`✅ Auth ok (${authLatencyMs.toFixed(2)} ms)`);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const queryLatencies = [];
  const retrievalMetrics = [];
  const answerCoverage = [];
  const faithfulnessScores = [];
  const sourceCountList = [];
  const successFlags = [];
  const perQuery = [];

  for (const item of dataset) {
    const start = performance.now();
    let answer = '';
    let sources = [];
    let ok = true;

    try {
      const response = await axios.post(`${BASE_URL}/chat/generate`, { query: item.query, limit: K }, { headers, timeout: 70000 });
      answer = response?.data?.data?.answer || '';
      sources = response?.data?.data?.sources || [];
    } catch (error) {
      ok = false;
    }

    const end = performance.now();
    const latency = end - start;
    queryLatencies.push(latency);
    sourceCountList.push((sources || []).length);

    const ret = evaluateRetrieval(sources, item.expectedSourceHints || [], K);
    if (ret.precisionAtK !== null) retrievalMetrics.push(ret);

    const coverage = keywordCoverage(answer, item.expectedAnswerKeywords || []);
    if (coverage !== null) answerCoverage.push(coverage);

    // Faithfulness: for DB-answered queries the sources are auxiliary docs, not the origin
    // of the answer — token overlap is misleadingly low.  Use keyword coverage as a proxy
    // for faithfulness when the answer is database-derived; use the standard text-overlap
    // method for document-grounded queries.
    const isDbBacked = (item.sourceType === 'database');
    let faith;
    if (isDbBacked && coverage !== null) {
      // DB query: answer is correct if it contains the expected facts (keyword coverage)
      faith = coverage;
    } else {
      faith = groundednessProxy(answer, sources);
    }
    faithfulnessScores.push(faith);

    // End-to-end "correct-like" proxy
    // Criteria:
    // 1) retrieval signal available -> require first relevant hit in top-k
    // 2) answer keyword coverage >= 0.5 (if labels available)
    let retrievalPass = true;
    if (ret.precisionAtK !== null) retrievalPass = (ret.relevantRetrieved || 0) > 0;

    let answerPass = true;
    if (coverage !== null) answerPass = coverage >= 0.5;

    const success = ok && retrievalPass && answerPass;
    successFlags.push(success ? 1 : 0);

    perQuery.push({
      id: item.id,
      query: item.query,
      sourceType: item.sourceType || 'unknown',
      ok,
      latencyMs: Number(latency.toFixed(2)),
      sourcesReturned: (sources || []).length,
      retrieval: {
        precisionAtK: ret.precisionAtK !== null ? Number(ret.precisionAtK.toFixed(4)) : null,
        recallAtK: ret.recallAtK !== null ? Number(ret.recallAtK.toFixed(4)) : null,
        mrr: ret.mrr !== null ? Number(ret.mrr.toFixed(4)) : null,
        ndcgAtK: ret.ndcgAtK !== null ? Number(ret.ndcgAtK.toFixed(4)) : null,
        firstRelevantRank: ret.firstRelevantRank
      },
      answerMetrics: {
        keywordCoverage: coverage !== null ? Number(coverage.toFixed(4)) : null,
        faithfulness: Number(faith.toFixed(4)),
        faithfulnessMethod: isDbBacked ? 'keyword-coverage-proxy' : 'token-overlap'
      },
      successProxy: success
    });
  }

  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      topK: K,
      datasetPath: DATASET_PATH,
      totalQueries: dataset.length
    },
    performance: {
      avgLatencyMs: Number(avg(queryLatencies).toFixed(2)),
      p50LatencyMs: Number(percentile(queryLatencies, 50).toFixed(2)),
      p95LatencyMs: Number(percentile(queryLatencies, 95).toFixed(2)),
      p99LatencyMs: Number(percentile(queryLatencies, 99).toFixed(2)),
      avgSourcesReturned: Number(avg(sourceCountList).toFixed(2))
    },
    retrievalQuality: retrievalMetrics.length ? {
      precisionAtK: Number(avg(retrievalMetrics.map(x => x.precisionAtK)).toFixed(4)),
      recallAtK: Number(avg(retrievalMetrics.map(x => x.recallAtK)).toFixed(4)),
      mrr: Number(avg(retrievalMetrics.map(x => x.mrr)).toFixed(4)),
      ndcgAtK: Number(avg(retrievalMetrics.map(x => x.ndcgAtK)).toFixed(4))
    } : {
      precisionAtK: null,
      recallAtK: null,
      mrr: null,
      ndcgAtK: null
    },
    answerQuality: {
      keywordCoverage: answerCoverage.length ? Number(avg(answerCoverage).toFixed(4)) : null,
      faithfulness: Number(avg(faithfulnessScores).toFixed(4))
    },
    endToEnd: {
      successRateProxy: Number((avg(successFlags) * 100).toFixed(2))
    },
    perQuery
  };

  const outPath = path.join(__dirname, 'rag-accuracy-metrics-results.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('\n📌 RAG ACCURACY METRICS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Queries:             ${summary.config.totalQueries}`);
  console.log(`Avg Latency:         ${summary.performance.avgLatencyMs} ms`);
  console.log(`P50/P95/P99:         ${summary.performance.p50LatencyMs} / ${summary.performance.p95LatencyMs} / ${summary.performance.p99LatencyMs} ms`);
  console.log(`Avg Sources:         ${summary.performance.avgSourcesReturned}`);

  console.log('\n🔍 Retrieval Quality');
  console.log(`Precision@${K}:      ${summary.retrievalQuality.precisionAtK}`);
  console.log(`Recall@${K}:         ${summary.retrievalQuality.recallAtK}`);
  console.log(`MRR:                 ${summary.retrievalQuality.mrr}`);
  console.log(`nDCG@${K}:           ${summary.retrievalQuality.ndcgAtK}`);

  console.log('\n🧠 Answer Quality');
  console.log(`Keyword Coverage:    ${summary.answerQuality.keywordCoverage}`);
  console.log(`Faithfulness:        ${summary.answerQuality.faithfulness}`);

  console.log('\n✅ End-to-End');
  console.log(`Success Rate Proxy:  ${summary.endToEnd.successRateProxy}%`);

  console.log(`\n💾 Full report saved to: ${outPath}`);
}

run().catch((error) => {
  console.error('❌ Accuracy metrics run failed:', error.response?.data || error.message || error);
  process.exit(1);
});
