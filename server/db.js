const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'mysql-193642ff-sarapanceria-2428.h.aivencloud.com',
  port: 18904,
  user: 'avnadmin',
  password: 'AVNS_kx5Pyg0weVglC2UeOVV',
  database: 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = db;