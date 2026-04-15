require('dotenv').config();
const APP_VERSION = '3.4.0'; // updated: IBM blue hero h1, businesscase h1, section-eyebrow color
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
app.use(express.static(path.join(__dirname), {
  setHeaders(res, filePath) {
    // CSS and JS: short cache + must-revalidate so browsers always check for updates
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    }
  }
}));

// ── DATABASE SETUP ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway internal Postgres (postgres:16 image) doesn't use SSL
  ssl: process.env.DATABASE_URL?.includes('.railway.internal') ? false
     : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

  // ── Roadmap tables ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roadmaps (
      id              TEXT PRIMARY KEY,
      client_id       TEXT NOT NULL REFERENCES clients(id),
      name            TEXT NOT NULL,
      scope_type      TEXT NOT NULL DEFAULT 'single_domain',
      domains         JSONB NOT NULL DEFAULT '[]',
      target_maturity DOUBLE PRECISION NOT NULL DEFAULT 3.75,
      priority_weights JSONB NOT NULL DEFAULT '{"gap":0.30,"strategic":0.25,"stakeholder":0.20,"value":0.15,"risk":0.10}',
      status          TEXT NOT NULL DEFAULT 'draft',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roadmap_gaps (
      id              TEXT PRIMARY KEY,
      roadmap_id      TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
      domain          TEXT NOT NULL,
      dimension       TEXT NOT NULL,
      current_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
      target_score    DOUBLE PRECISION NOT NULL DEFAULT 3.75,
      gap             DOUBLE PRECISION NOT NULL DEFAULT 0,
      priority_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
      priority_rank   INTEGER NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roadmap_initiatives (
      id                    TEXT PRIMARY KEY,
      roadmap_id            TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
      gap_id                TEXT REFERENCES roadmap_gaps(id) ON DELETE SET NULL,
      library_ref           TEXT NOT NULL DEFAULT '',
      name                  TEXT NOT NULL,
      description           TEXT NOT NULL DEFAULT '',
      horizon               TEXT NOT NULL DEFAULT 'short',
      horizon_override      TEXT,
      estimated_annual_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      implementation_cost   DOUBLE PRECISION NOT NULL DEFAULT 0,
      roi_pct               DOUBLE PRECISION NOT NULL DEFAULT 0,
      payback_months        INTEGER NOT NULL DEFAULT 0,
      impact_categories     JSONB NOT NULL DEFAULT '{}',
      start_month           INTEGER NOT NULL DEFAULT 1,
      duration_months       INTEGER NOT NULL DEFAULT 3,
      effort_size           TEXT NOT NULL DEFAULT 'M',
      status                TEXT NOT NULL DEFAULT 'planned',
      dependencies          JSONB NOT NULL DEFAULT '[]',
      engagement_template   JSONB NOT NULL DEFAULT '{}'
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

// ── ROADMAP ROUTES ────────────────────────────────────────────────────────
app.get('/api/roadmaps', async (req, res) => {
  const { client_id } = req.query;
  try {
    let q = 'SELECT * FROM roadmaps';
    const params = [];
    if (client_id) { q += ' WHERE client_id = $1'; params.push(client_id); }
    q += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/roadmaps/:id', async (req, res) => {
  try {
    const { rows: [roadmap] } = await pool.query('SELECT * FROM roadmaps WHERE id = $1', [req.params.id]);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    const { rows: gaps } = await pool.query('SELECT * FROM roadmap_gaps WHERE roadmap_id = $1 ORDER BY priority_rank', [req.params.id]);
    const { rows: initiatives } = await pool.query('SELECT * FROM roadmap_initiatives WHERE roadmap_id = $1 ORDER BY start_month, horizon', [req.params.id]);
    res.json({ ...roadmap, gaps, initiatives });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/roadmaps', async (req, res) => {
  const { client_id, name, scope_type, domains, target_maturity, priority_weights } = req.body;
  if (!client_id || !name) return res.status(400).json({ error: 'client_id and name required' });
  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO roadmaps (id,client_id,name,scope_type,domains,target_maturity,priority_weights)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, client_id, name, scope_type || 'single_domain',
       JSON.stringify(domains || []), target_maturity || 3.75,
       JSON.stringify(priority_weights || {gap:0.30,strategic:0.25,stakeholder:0.20,value:0.15,risk:0.10})]
    );
    res.json({ id, message: 'Roadmap created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/roadmaps/:id', async (req, res) => {
  const { name, target_maturity, priority_weights, status } = req.body;
  try {
    await pool.query(
      `UPDATE roadmaps SET
        name = COALESCE($1, name), target_maturity = COALESCE($2, target_maturity),
        priority_weights = COALESCE($3, priority_weights), status = COALESCE($4, status),
        updated_at = NOW()
       WHERE id = $5`,
      [name ?? null, target_maturity ?? null,
       priority_weights ? JSON.stringify(priority_weights) : null,
       status ?? null, req.params.id]
    );
    res.json({ message: 'Roadmap updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/roadmaps/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM roadmaps WHERE id = $1', [req.params.id]);
    res.json({ message: 'Roadmap deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk-save gaps + initiatives for a roadmap (generated client-side)
app.post('/api/roadmaps/:id/generate', async (req, res) => {
  const { gaps, initiatives } = req.body;
  if (!gaps || !initiatives) return res.status(400).json({ error: 'gaps and initiatives required' });
  try {
    // Clear existing
    await pool.query('DELETE FROM roadmap_initiatives WHERE roadmap_id = $1', [req.params.id]);
    await pool.query('DELETE FROM roadmap_gaps WHERE roadmap_id = $1', [req.params.id]);
    // Insert gaps
    for (const g of gaps) {
      await pool.query(
        `INSERT INTO roadmap_gaps (id,roadmap_id,domain,dimension,current_score,target_score,gap,priority_score,priority_rank)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [g.id, req.params.id, g.domain, g.dimension, g.current_score, g.target_score, g.gap, g.priority_score, g.priority_rank]
      );
    }
    // Insert initiatives
    for (const i of initiatives) {
      await pool.query(
        `INSERT INTO roadmap_initiatives
          (id,roadmap_id,gap_id,library_ref,name,description,horizon,estimated_annual_value,
           implementation_cost,roi_pct,payback_months,impact_categories,start_month,
           duration_months,effort_size,status,dependencies,engagement_template)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [i.id, req.params.id, i.gap_id, i.library_ref, i.name, i.description, i.horizon,
         i.estimated_annual_value, i.implementation_cost, i.roi_pct, i.payback_months,
         JSON.stringify(i.impact_categories), i.start_month, i.duration_months,
         i.effort_size, i.status || 'planned', JSON.stringify(i.dependencies || []),
         JSON.stringify(i.engagement_template || {})]
      );
    }
    await pool.query("UPDATE roadmaps SET status='active', updated_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ message: 'Roadmap generated', gaps: gaps.length, initiatives: initiatives.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/roadmaps/:roadmap_id/initiatives/:id', async (req, res) => {
  const { horizon_override, start_month, status, estimated_annual_value, implementation_cost } = req.body;
  try {
    await pool.query(
      `UPDATE roadmap_initiatives SET
        horizon_override = COALESCE($1, horizon_override),
        start_month = COALESCE($2, start_month),
        status = COALESCE($3, status),
        estimated_annual_value = COALESCE($4, estimated_annual_value),
        implementation_cost = COALESCE($5, implementation_cost)
       WHERE id = $6 AND roadmap_id = $7`,
      [horizon_override ?? null, start_month ?? null, status ?? null,
       estimated_annual_value ?? null, implementation_cost ?? null,
       req.params.id, req.params.roadmap_id]
    );
    res.json({ message: 'Initiative updated' });
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
