/**
 * Concurrency Test — Atomic Stock Deduction
 * ==========================================
 * Proves that the atomic findOneAndUpdate guard prevents overselling
 * when multiple requests arrive simultaneously for the same item.
 *
 * What it does:
 *   1. Logs in as TechStore owner to get a JWT
 *   2. Finds (or creates) a product variant with stock = 1
 *   3. Fires N simultaneous POST /api/orders requests for qty = 1
 *   4. Expects exactly 1 success (201) and N-1 failures (409)
 *   5. Verifies DB stock is 0 (not negative)
 *
 * Run:  node scripts/testConcurrency.js
 * Requires: server running + seed data loaded
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios     = require('axios');
const mongoose  = require('mongoose');
const connectDB = require('../src/config/db');
const Product   = require('../src/models/Product');
const User      = require('../src/models/User');

const BASE_URL        = `http://localhost:${process.env.PORT || 5000}/api`;
const CONCURRENT_REQS = 10;   // number of simultaneous order attempts

// ── ANSI colours ──────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;

async function run() {
  console.log(bold('\n═══ Concurrency Test: Atomic Stock Deduction ═══\n'));

  // ── 1. Connect to DB ─────────────────────────────────────────────
  await connectDB();
  console.log(cyan('✓ Connected to MongoDB'));

  // ── 2. Get a tenant owner JWT ────────────────────────────────────
  let token;
  try {
    const { data } = await axios.post(`${BASE_URL}/auth/login`, {
      email:    'owner@techstore.com',
      password: 'password123',
    });
    token = data.token;
    console.log(cyan(`✓ Logged in as: ${data.user.name} (${data.tenant.name})`));
  } catch (err) {
    console.error(red('✗ Login failed — run the seed script first: npm run seed'));
    process.exit(1);
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── 3. Find or set up a variant with exactly 1 unit of stock ─────
  // Find any active product and pick first variant
  const product = await Product.findOne({ isActive: true }).lean();
  if (!product || !product.variants?.length) {
    console.error(red('✗ No products found — run the seed script first: npm run seed'));
    process.exit(1);
  }

  const testVariant = product.variants[0];
  const TEST_SKU    = testVariant.sku;

  // Set stock to exactly 1 so only 1 order can succeed
  await Product.updateOne(
    { _id: product._id, 'variants.sku': TEST_SKU },
    { $set: { 'variants.$.stock': 1 } }
  );
  console.log(cyan(`✓ Set stock for SKU "${TEST_SKU}" → 1 unit`));
  console.log(yellow(`\n→ Firing ${CONCURRENT_REQS} simultaneous orders for qty=1 of "${TEST_SKU}"...`));

  // ── 4. Fire all requests simultaneously ──────────────────────────
  const orderPayload = {
    customerName: 'Test Concurrency Customer',
    items: [{ productId: product._id.toString(), variantSku: TEST_SKU, quantity: 1 }],
  };

  const start    = Date.now();
  const requests = Array.from({ length: CONCURRENT_REQS }, () =>
    axios
      .post(`${BASE_URL}/orders`, orderPayload, { headers: authHeaders })
      .then((r) => ({ status: r.status, data: r.data }))
      .catch((e) => ({ status: e.response?.status, data: e.response?.data }))
  );

  const results  = await Promise.all(requests);
  const elapsed  = Date.now() - start;

  // ── 5. Analyse results ───────────────────────────────────────────
  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const others    = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log('\n' + bold('─── Results ───────────────────────────────────────'));
  console.log(`  Total requests  : ${CONCURRENT_REQS}`);
  console.log(`  Time elapsed    : ${elapsed}ms`);
  console.log(`  ${green('✓ Successes (201)')}: ${successes.length}  ← should be 1`);
  console.log(`  ${red('✗ Conflicts (409)')}: ${conflicts.length}  ← should be ${CONCURRENT_REQS - 1}`);
  if (others.length) console.log(`  ${yellow('? Other')}: ${others.length}  ${JSON.stringify(others.map((r) => r.status))}`);

  // ── 6. Verify DB stock is 0, never negative ───────────────────────
  const afterProduct = await Product.findOne(
    { _id: product._id, 'variants.sku': TEST_SKU },
    { 'variants.$': 1 }
  ).lean();
  const finalStock = afterProduct?.variants?.[0]?.stock ?? 'unknown';

  console.log(bold('\n─── DB Verification ────────────────────────────────'));
  console.log(`  Final stock for "${TEST_SKU}": ${finalStock === 0 ? green(finalStock) : red(finalStock)} (expected 0)`);

  // ── 7. Pass / Fail ────────────────────────────────────────────────
  const passed = successes.length === 1 && conflicts.length === CONCURRENT_REQS - 1 && finalStock === 0;
  console.log('\n' + bold('─── Verdict ────────────────────────────────────────'));
  if (passed) {
    console.log(green(bold('  ✓ TEST PASSED — Concurrency protection works correctly!')));
    console.log(green('  Exactly 1 order succeeded; all others got 409 Insufficient Stock.'));
    console.log(green('  Stock is 0, not negative. No overselling occurred.'));
  } else {
    console.log(red(bold('  ✗ TEST FAILED')));
    if (successes.length !== 1)
      console.log(red(`    Expected 1 success, got ${successes.length}`));
    if (finalStock !== 0)
      console.log(red(`    Stock should be 0, got ${finalStock}`));
  }

  if (successes.length > 0) {
    console.log(cyan(`\n  Winning order: ${successes[0].data?.data?.orderNumber}`));
  }
  if (conflicts.length > 0) {
    console.log(yellow(`\n  Sample 409 message: "${conflicts[0].data?.message}"`));
  }

  console.log();
  await mongoose.disconnect();
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error(red(`Fatal: ${err.message}`));
  process.exit(1);
});
