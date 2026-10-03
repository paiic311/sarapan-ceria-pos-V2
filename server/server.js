const express = require('express');
const cors = require('cors');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS connected');

    res.json({
      message: 'Backend Sarapan Ceria berjalan!',
      database: rows[0].connected === 1 ? 'terhubung' : 'gagal'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Database gagal terhubung',
      error: error.message
    });
  }
});

// CRUD

app.get('/api/vendors', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, phone, created_at FROM vendors ORDER BY created_at DESC'
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    await db.query(
      `UPDATE vendors
       SET name = ?, phone = ?
       WHERE id = ?`,
      [name, phone || null, id]
    );

    io.emit('data:changed');

    res.json({
      message: 'Vendor berhasil diubah',
      id
    });
  } catch (error) {
    console.error('PUT /api/vendors error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM vendors WHERE id = ?',
      [id]
    );

    io.emit('data:changed');

    res.json({
      message: 'Vendor berhasil dihapus',
      id
    });
  } catch (error) {
    console.error('DELETE /api/vendors error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const { id, name, phone, createdAt } = req.body;

    await db.query(
      `INSERT INTO vendors (id, name, phone, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        id,
        name,
        phone || null,
        createdAt
          ? new Date(createdAt).toISOString().slice(0, 19).replace('T', ' ')
          : new Date()
      ]
    );

    io.emit('data:changed');

    res.json({
      message: 'Vendor berhasil ditambahkan',
      id
    });
  } catch (error) {
    console.error('POST /api/vendors error:', error);
    res.status(500).json({ error: error.message });
  }
});

// produk

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        vendor_id,
        name,
        base_price,
        sale_price,
        created_at
      FROM products
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('GET /api/products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const {
      id,
      vendorId,
      name,
      basePrice,
      salePrice,
      createdAt
    } = req.body;

    await db.query(
      `INSERT INTO products
       (id, vendor_id, name, base_price, sale_price, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        vendorId || null,
        name,
        basePrice || 0,
        salePrice || 0,
        createdAt
          ? new Date(createdAt).toISOString().slice(0, 19).replace('T', ' ')
          : new Date()
      ]
    );

    io.emit('data:changed');

    res.json({
      message: 'Product berhasil ditambahkan',
      id
    });
  } catch (error) {
    console.error('POST /api/products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vendorId,
      name,
      basePrice,
      salePrice
    } = req.body;

    await db.query(
      `UPDATE products
       SET vendor_id = ?,
           name = ?,
           base_price = ?,
           sale_price = ?
       WHERE id = ?`,
      [
        vendorId || null,
        name,
        basePrice || 0,
        salePrice || 0,
        id
      ]
    );

    io.emit('data:changed');

    res.json({
      message: 'Product berhasil diubah',
      id
    });
  } catch (error) {
    console.error('PUT /api/products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM products WHERE id = ?',
      [id]
    );

    io.emit('data:changed');

    res.json({
      message: 'Product berhasil dihapus',
      id
    });
  } catch (error) {
    console.error('DELETE /api/products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DAILY RECORDS

app.get('/api/daily-records', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        date,
        vendor_id,
        note,
        is_handed_over,
        created_at
      FROM daily_records
      ORDER BY date DESC, created_at ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('GET /api/daily-records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/daily-records', async (req, res) => {
  try {
    const {
      id,
      date,
      vendorId,
      note,
      isHandedOver
    } = req.body;

    await db.query(
      `INSERT INTO daily_records
       (id, date, vendor_id, note, is_handed_over)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        date,
        vendorId,
        note || '',
        isHandedOver ? 1 : 0
      ]
    );

    io.emit('data:changed');

    res.json({
      message: 'Daily record berhasil ditambahkan',
      id
    });
  } catch (error) {
    console.error('POST /api/daily-records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/daily-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      note,
      isHandedOver
    } = req.body;

    await db.query(
      `UPDATE daily_records
       SET note = ?,
           is_handed_over = ?
       WHERE id = ?`,
      [
        note || '',
        isHandedOver ? 1 : 0,
        id
      ]
    );

    io.emit('data:changed');

    res.json({
      message: 'Daily record berhasil diubah',
      id
    });
  } catch (error) {
    console.error('PUT /api/daily-records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/daily-records/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM daily_records WHERE id = ?',
      [id]
    );

    io.emit('data:changed');

    res.json({
      message: 'Daily record berhasil dihapus',
      id
    });
  } catch (error) {
    console.error('DELETE /api/daily-records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/daily-records/full', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        dr.id AS record_id,
        dr.date,
        dr.vendor_id,
        dr.note,
        dr.is_handed_over,

        di.id AS item_id,
        di.product_id,
        di.product_name,
        di.base_price,
        di.sale_price,
        di.qty_titip,
        di.qty_sold

      FROM daily_records dr
      LEFT JOIN daily_items di
        ON di.daily_record_id = dr.id

      ORDER BY dr.date DESC, dr.created_at ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('GET /api/daily-records/full error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/daily-items', async (req, res) => {
  try {
    const {
      id,
      dailyRecordId,
      productId,
      productName,
      basePrice,
      salePrice,
      qtyTitip,
      qtySold
    } = req.body;

    await db.query(
      `INSERT INTO daily_items
       (id, daily_record_id, product_id, product_name,
        base_price, sale_price, qty_titip, qty_sold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        dailyRecordId,
        productId || null,
        productName || '',
        basePrice || 0,
        salePrice || 0,
        qtyTitip || 0,
        qtySold || 0
      ]
    );

    io.emit('data:changed');

    res.json({
      message: 'Daily item berhasil ditambahkan',
      id
    });
  } catch (error) {
    console.error('POST /api/daily-items error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/daily-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      productId,
      productName,
      basePrice,
      salePrice,
      qtyTitip,
      qtySold
    } = req.body;

    await db.query(
      `UPDATE daily_items
       SET product_id = ?,
           product_name = ?,
           base_price = ?,
           sale_price = ?,
           qty_titip = ?,
           qty_sold = ?
       WHERE id = ?`,
      [
        productId || null,
        productName || '',
        basePrice || 0,
        salePrice || 0,
        qtyTitip || 0,
        qtySold || 0,
        id
      ]
    );

    io.emit('data:changed');
    res.json({ message: 'Daily item berhasil diubah' });
  } catch (error) {
    console.error('PUT /api/daily-items error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/daily-items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM daily_items WHERE id = ?',
      [id]
    );

    io.emit('data:changed');
    res.json({
      message: 'Daily item berhasil dihapus',
      id
    });
  } catch (error) {
    console.error('DELETE /api/daily-items error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reset-all-data', async (req, res) => {
  try {
    await db.query('DELETE FROM daily_items');
    await db.query('DELETE FROM daily_records');
    await db.query('DELETE FROM products');
    await db.query('DELETE FROM vendors');

    io.emit('data:changed');

    res.json({
      message: 'Semua data berhasil dihapus'
    });
  } catch (error) {
    console.error('RESET DATA ERROR:', error);

    res.status(500).json({
      message: 'Gagal menghapus semua data',
      error: error.message
    });
  }
});

const PORT = 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {
  console.log('Client terhubung:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client terputus:', socket.id);
  });
});

server.listen(PORT,'0.0.0.0', () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});