const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// قاعدة البيانات
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// تهيئة الجداول
function initializeDatabase() {
  // جدول المستخدمين
  db.run(`CREATE TABLE IF NOT EXISTS Users (
    UserID INTEGER PRIMARY KEY AUTOINCREMENT,
    FullName TEXT NOT NULL,
    UserType TEXT NOT NULL CHECK(UserType IN ('مزود', 'مدير')),
    Email TEXT UNIQUE,
    PhoneNumber TEXT,
    IsVerified BOOLEAN DEFAULT 0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // جدول التخصصات
  db.run(`CREATE TABLE IF NOT EXISTS Specializations (
    SpecID INTEGER PRIMARY KEY AUTOINCREMENT,
    SpecName TEXT NOT NULL,
    IconURL TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // جدول الخدمات
  db.run(`CREATE TABLE IF NOT EXISTS Services (
    ServiceID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER,
    SpecID INTEGER,
    Title TEXT NOT NULL,
    Description TEXT,
    BasePrice DECIMAL(10,2),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (SpecID) REFERENCES Specializations(SpecID)
  )`);

  // جدول طلبات التواصل
  db.run(`CREATE TABLE IF NOT EXISTS ContactRequests (
    RequestID INTEGER PRIMARY KEY AUTOINCREMENT,
    RequestedServiceID INTEGER,
    ClientPhoneNumber TEXT NOT NULL,
    ClientRequestDescription TEXT,
    Status TEXT DEFAULT 'قيد المراجعة',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RequestedServiceID) REFERENCES Services(ServiceID)
  )`);

  // جدول المعاملات
  db.run(`CREATE TABLE IF NOT EXISTS Transactions (
    TransID INTEGER PRIMARY KEY AUTOINCREMENT,
    RequestID INTEGER,
    TotalAmount DECIMAL(10,2),
    PlatformFee DECIMAL(10,2),
    ProfessionalPayout DECIMAL(10,2),
    PaymentStatus TEXT DEFAULT 'معلق',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RequestID) REFERENCES ContactRequests(RequestID)
  )`);

  // إضافة بيانات تجريبية
  addSampleData();
}

function addSampleData() {
  // إضافة تخصصات
  const specializations = [
    { name: 'مصورون', icon: '📷' },
    { name: 'مترجمون', icon: '🌐' },
    { name: 'مصممون', icon: '🎨' },
    { name: 'مبرمجون', icon: '💻' },
    { name: 'كتاب', icon: '✍️' },
    { name: 'مدربون', icon: '🏋️' }
  ];

  specializations.forEach(spec => {
    db.run(`INSERT OR IGNORE INTO Specializations (SpecName, IconURL) VALUES (?, ?)`, 
      [spec.name, spec.icon]);
  });

  // إضافة مستخدمين تجريبيين
  db.run(`INSERT OR IGNORE INTO Users (FullName, UserType, Email, PhoneNumber, IsVerified) VALUES 
    ('أحمد محمد', 'مزود', 'ahmed@example.com', '0512345678', 1),
    ('فاطمة عبدالله', 'مزود', 'fatima@example.com', '0554321098', 1),
    ('مدير النظام', 'مدير', 'admin@example.com', '0500000000', 1)`);
}

// الروات (Routes)

// جلب جميع التخصصات
app.get('/api/specializations', (req, res) => {
  db.all('SELECT * FROM Specializations ORDER BY SpecName', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// جلب الخدمات حسب التخصص
app.get('/api/services/:specId', (req, res) => {
  const specId = req.params.specId;
  const sql = `
    SELECT s.*, u.FullName, u.IsVerified 
    FROM Services s 
    JOIN Users u ON s.UserID = u.UserID 
    WHERE s.SpecID = ? AND u.IsVerified = 1
  `;
  
  db.all(sql, [specId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// إنشاء طلب تواصل جديد
app.post('/api/contact-requests', (req, res) => {
  const { requestedServiceID, clientPhoneNumber, clientRequestDescription } = req.body;
  
  const sql = `INSERT INTO ContactRequests (RequestedServiceID, ClientPhoneNumber, ClientRequestDescription) VALUES (?, ?, ?)`;
  
  db.run(sql, [requestedServiceID, clientPhoneNumber, clientRequestDescription], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      message: 'تم إرسال طلبك بنجاح', 
      requestID: this.lastID 
    });
  });
});

// جلب طلبات التواصل
app.get('/api/contact-requests', (req, res) => {
  const sql = `
    SELECT cr.*, s.Title as ServiceTitle, u.FullName as ProfessionalName 
    FROM ContactRequests cr 
    JOIN Services s ON cr.RequestedServiceID = s.ServiceID 
    JOIN Users u ON s.UserID = u.UserID 
    ORDER BY cr.CreatedAt DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
