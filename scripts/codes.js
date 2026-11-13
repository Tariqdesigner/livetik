// Generate activation codes: node scripts/codes.js <days> [count] [plan]
//   node scripts/codes.js 30 10      → 10 one-month codes
//   node scripts/codes.js 365 1      → one yearly code
// Needs DATABASE_URL (same as the API). Prints the codes, one per line.
const { createPool, migrate } = require('../src/db');
const { generateCode } = require('../src/auth');

(async () => {
  const days = Number(process.argv[2]);
  const count = Number(process.argv[3] || 1);
  const plan = process.argv[4] || 'pro';
  if (!Number.isInteger(days) || days < 1 || !Number.isInteger(count) || count < 1 || count > 1000) {
    console.error('Usage: node scripts/codes.js <days> [count=1] [plan=pro]');
    process.exit(1);
  }
  const pool = createPool();
  await migrate(pool);
  const out = [];
  while (out.length < count) {
    const code = generateCode();
    const r = await pool.query('INSERT INTO activation_codes (code, plan, days) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [code, plan, days]);
    if (r.rowCount) out.push(code);
  }
  console.log(out.join('\n'));
  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
