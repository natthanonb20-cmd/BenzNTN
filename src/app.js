require('dotenv').config();
const express = require('express');
const path = require('path');

const authRoutes    = require('./routes/auth');
const adminRoutes   = require('./routes/admin');
const uploadRoutes  = require('./routes/upload');
const roomRoutes    = require('./routes/rooms');
const tenantRoutes  = require('./routes/tenants');
const invoiceRoutes = require('./routes/invoices');
const webhookRoutes = require('./routes/webhook');
const settingRoutes = require('./routes/settings');
const queueRoutes   = require('./routes/queue');
const waterRoutes   = require('./routes/water');

const app = express();

// Body parsing — webhook route needs raw body for signature verification
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/auth',     authRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/upload',   uploadRoutes);
app.use('/api/rooms',    roomRoutes);
app.use('/api/tenants',  tenantRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/queue',    queueRoutes);
app.use('/api/water',         waterRoutes);
app.use('/api/bank-accounts', require('./routes/bankAccounts'));
app.use('/webhook',           webhookRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// Config endpoint — ส่ง BASE_URL ให้ frontend ใช้แสดง Webhook URL
app.get('/api/config/base-url', (_, res) => {
  res.json({ baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hordee running on port ${PORT}`));
