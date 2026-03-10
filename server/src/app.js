const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const smeRoutes = require('./routes/smes');
const requestRoutes = require('./routes/smeRequests');
const respondRoutes = require('./routes/respond');
const dashboardRoutes = require('./routes/dashboard');
const visitorSigninsRoutes = require('./routes/visitorSignins');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/smes', smeRoutes);
app.use('/api/sme-requests', requestRoutes);
app.use('/api/respond', respondRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/visitor-signins', visitorSigninsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
