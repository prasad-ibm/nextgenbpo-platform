require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { randomUUID: uuidv4, createHmac } = require('crypto');
const path = require('path');
const fs = require('fs');

// ── AUTH HELPERS ───────────────────────────────────────────────────────────
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-secret-not-for-prod';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function signToken(clientName) {
  const ts = Date.now().toString();
  const payload = `${clientName}:${ts}`;
  const sig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

function verifyToken(token) {
  try {
    const { payload, sig } = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const expected = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    if (sig !== expected) return null;
    const [clientName, ts] = payload.split(':');
    if (Date.now() - parseInt(ts, 10) > TOKEN_TTL_MS) return null;
    return clientName;
  } catch { return null; }
}

const app = express();
const PORT = process.env.PORT || 3031;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── DATABASE SETUP ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      industry    TEXT DEFAULT '',
      size        TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id                 TEXT PRIMARY KEY,
      client_id          TEXT NOT NULL REFERENCES clients(id),
      stakeholder_name   TEXT NOT NULL,
      stakeholder_role   TEXT DEFAULT '',
      stakeholder_email  TEXT DEFAULT '',
      domain             TEXT NOT NULL,
      answers            JSONB NOT NULL DEFAULT '[]',
      scores             JSONB NOT NULL DEFAULT '{}',
      overall_score      DOUBLE PRECISION NOT NULL DEFAULT 0,
      maturity_level     TEXT NOT NULL DEFAULT 'L1',
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS engagements (
      id              TEXT PRIMARY KEY,
      client_id       TEXT NOT NULL REFERENCES clients(id),
      engagement_name TEXT NOT NULL,
      domain          TEXT NOT NULL,
      workstream      TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'pipeline',
      progress        INTEGER DEFAULT 0,
      sponsor         TEXT DEFAULT '',
      sponsor_email   TEXT DEFAULT '',
      start_date      TEXT DEFAULT '',
      target_date     TEXT DEFAULT '',
      investment      DOUBLE PRECISION DEFAULT 0,
      projected_savings DOUBLE PRECISION DEFAULT 0,
      actual_savings  DOUBLE PRECISION DEFAULT 0,
      fte_redeployed  INTEGER DEFAULT 0,
      cycle_time_reduction INTEGER DEFAULT 0,
      kpi_target      TEXT DEFAULT '',
      kpi_actual      TEXT DEFAULT '',
      notes           TEXT DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log('✅ NextGen BPO database tables ready');
}

// ── CLIENT ROUTES ──────────────────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clients', async (req, res) => {
  const { name, industry, size } = req.body;
  if (!name) return res.status(400).json({ error: 'Client name required' });
  try {
    const id = uuidv4();
    await pool.query(
      'INSERT INTO clients (id, name, industry, size) VALUES ($1, $2, $3, $4)',
      [id, name, industry || '', size || '']
    );
    res.json({ id, name, industry, size });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ASSESSMENT ROUTES ──────────────────────────────────────────────────────
app.get('/api/assessments', async (req, res) => {
  const { client_id, domain } = req.query;
  const params = [];
  let idx = 1;
  let q = 'SELECT * FROM assessments WHERE 1=1';
  if (client_id) { q += ` AND client_id = $${idx++}`; params.push(client_id); }
  if (domain)    { q += ` AND domain = $${idx++}`;    params.push(domain); }
  q += ' ORDER BY created_at DESC';
  try {
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/assessments', async (req, res) => {
  const { client_id, stakeholder_name, stakeholder_role, stakeholder_email,
          domain, answers, scores, overall_score, maturity_level } = req.body;
  if (!client_id || !stakeholder_name || !domain || !answers)
    return res.status(400).json({ error: 'Missing required fields' });
  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO assessments
        (id,client_id,stakeholder_name,stakeholder_role,stakeholder_email,domain,answers,scores,overall_score,maturity_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, client_id, stakeholder_name, stakeholder_role || '', stakeholder_email || '',
       domain, JSON.stringify(answers), JSON.stringify(scores), overall_score || 0, maturity_level || 'L1']
    );
    res.json({ id, message: 'Assessment saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/assessments/aggregate/:client_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM assessments WHERE client_id = $1', [req.params.client_id]
    );
    if (!rows.length) return res.json({ message: 'No assessments yet', data: [] });

    const byDomain = {};
    rows.forEach(r => {
      const scores = typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores;
      if (!byDomain[r.domain])
        byDomain[r.domain] = { domain: r.domain, stakeholders: [], avgScores: {}, overallAvg: 0 };
      byDomain[r.domain].stakeholders.push({
        name: r.stakeholder_name, role: r.stakeholder_role, overall: r.overall_score, scores
      });
    });
    Object.values(byDomain).forEach(d => {
      const dims = {};
      d.stakeholders.forEach(s => {
        Object.entries(s.scores).forEach(([dim, val]) => {
          if (!dims[dim]) dims[dim] = [];
          dims[dim].push(val);
        });
      });
      Object.entries(dims).forEach(([dim, vals]) => {
        d.avgScores[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
      });
      d.overallAvg = d.stakeholders.reduce((a, s) => a + s.overall, 0) / d.stakeholders.length;
    });
    res.json({ client_id: req.params.client_id, domains: Object.values(byDomain) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ENGAGEMENT / TRANSFORMATION PIPELINE ROUTES ────────────────────────────
app.get('/api/engagements', async (req, res) => {
  const { client_id, status, domain } = req.query;
  const params = [];
  let idx = 1;
  let q = 'SELECT * FROM engagements WHERE 1=1';
  if (client_id) { q += ` AND client_id = $${idx++}`; params.push(client_id); }
  if (status)    { q += ` AND status = $${idx++}`;    params.push(status); }
  if (domain)    { q += ` AND domain = $${idx++}`;    params.push(domain); }
  q += ' ORDER BY created_at DESC';
  try {
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/engagements', async (req, res) => {
  const { client_id, engagement_name, domain, workstream, status, progress,
          sponsor, sponsor_email, start_date, target_date,
          investment, projected_savings, actual_savings, fte_redeployed,
          cycle_time_reduction, kpi_target, kpi_actual, notes } = req.body;
  if (!client_id || !engagement_name || !domain)
    return res.status(400).json({ error: 'Missing required fields' });
  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO engagements
        (id,client_id,engagement_name,domain,workstream,status,progress,sponsor,sponsor_email,
         start_date,target_date,investment,projected_savings,actual_savings,fte_redeployed,
         cycle_time_reduction,kpi_target,kpi_actual,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [id, client_id, engagement_name, domain, workstream || '', status || 'pipeline',
       progress || 0, sponsor || '', sponsor_email || '', start_date || '', target_date || '',
       investment || 0, projected_savings || 0, actual_savings || 0,
       fte_redeployed || 0, cycle_time_reduction || 0,
       kpi_target || '', kpi_actual || '', notes || '']
    );
    res.json({ id, message: 'Engagement created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/engagements/:id', async (req, res) => {
  const { status, progress, actual_savings, fte_redeployed, cycle_time_reduction, kpi_actual, notes } = req.body;
  try {
    await pool.query(
      `UPDATE engagements SET
        status               = COALESCE($1, status),
        progress             = COALESCE($2, progress),
        actual_savings       = COALESCE($3, actual_savings),
        fte_redeployed       = COALESCE($4, fte_redeployed),
        cycle_time_reduction = COALESCE($5, cycle_time_reduction),
        kpi_actual           = COALESCE($6, kpi_actual),
        notes                = COALESCE($7, notes),
        updated_at           = NOW()
       WHERE id = $8`,
      [status ?? null, progress ?? null, actual_savings ?? null,
       fte_redeployed ?? null, cycle_time_reduction ?? null,
       kpi_actual ?? null, notes ?? null, req.params.id]
    );
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/engagements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM engagements WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ROI SUMMARY ────────────────────────────────────────────────────────────
app.get('/api/roi-summary/:client_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM engagements WHERE client_id = $1', [req.params.client_id]
    );
    const summary = {
      total_investment:       rows.reduce((s, r) => s + (r.investment || 0), 0),
      total_projected_savings:rows.reduce((s, r) => s + (r.projected_savings || 0), 0),
      total_actual_savings:   rows.reduce((s, r) => s + (r.actual_savings || 0), 0),
      total_fte_redeployed:   rows.reduce((s, r) => s + (r.fte_redeployed || 0), 0),
      by_domain: {},
      by_status: { pipeline: 0, assess: 0, design: 0, transform: 0, operate: 0, complete: 0 },
      engagements: rows.length
    };
    rows.forEach(r => {
      summary.by_status[r.status] = (summary.by_status[r.status] || 0) + 1;
      if (!summary.by_domain[r.domain])
        summary.by_domain[r.domain] = { investment: 0, projected: 0, actual: 0, fte: 0, count: 0 };
      summary.by_domain[r.domain].investment += r.investment || 0;
      summary.by_domain[r.domain].projected  += r.projected_savings || 0;
      summary.by_domain[r.domain].actual     += r.actual_savings || 0;
      summary.by_domain[r.domain].fte        += r.fte_redeployed || 0;
      summary.by_domain[r.domain].count++;
    });
    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── LOGIN & VERIFY ─────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { clientName, password } = req.body || {};
  const validName = process.env.CLIENT_NAME || '';
  const validPass = process.env.CLIENT_PASSWORD || '';
  if (!validName || !validPass)
    return res.status(503).json({ error: 'Auth not configured on server' });
  if (!clientName || !password || clientName !== validName || password !== validPass)
    return res.status(401).json({ error: 'Invalid client name or password' });
  res.json({ token: signToken(clientName), clientName });
});

app.get('/api/verify', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const clientName = verifyToken(token);
  if (!clientName) return res.status(401).json({ error: 'Invalid or expired session' });
  res.json({ ok: true, clientName });
});

// ── PLATFORM CONFIG ────────────────────────────────────────────────────────
app.get('/config.js', (req, res) => {
  const protectedMode = process.env.PROTECTED_MODE === 'true';
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`window.PLATFORM_CONFIG = { protectedMode: ${protectedMode} };`);
});

// ── CATCH-ALL → serve .html files ──────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  const exactFile = path.join(__dirname, req.path);
  if (fs.existsSync(exactFile) && fs.statSync(exactFile).isFile()) return res.sendFile(exactFile);
  const htmlFile = path.join(__dirname, req.path + '.html');
  if (fs.existsSync(htmlFile)) return res.sendFile(htmlFile);
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── BOOT (with retry for DB startup race on Railway) ───────────────────────
async function bootWithRetry(maxAttempts = 10, delayMs = 3000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await initDB();
      app.listen(PORT, () =>
        console.log(`🚀 NextGen BPO Intelligence Platform running on http://localhost:${PORT}`)
      );
      return;
    } catch (err) {
      console.error(`❌ DB init attempt ${i}/${maxAttempts} failed: ${err.message}`);
      if (i === maxAttempts) { process.exit(1); }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
bootWithRetry();
