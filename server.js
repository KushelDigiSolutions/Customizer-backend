const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_jwt_secret_key'; // Change this to a strong secret in production
const nodemailer = require('nodemailer');
const cron = require('node-cron');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const bcrypt = require('bcrypt');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '13.201.29.82',
  user: process.env.DB_USER || 'admin_customiser',
  password: process.env.DB_PASSWORD || 'Chirag@2025',
  database: process.env.DB_NAME || 'admin_customiser',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
});


// Database Tables Creation
const createTables = async () => {
  try {
    const connection = await pool.getConnection();
    
    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role ENUM('user', 'admin', 'superadmin') DEFAULT 'user',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Configurations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS configurations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        store_id VARCHAR(255) NOT NULL,
        store_url TEXT,
        store_access_token TEXT,
        store_endpoint TEXT,
        subscription ENUM('active', 'inactive') DEFAULT 'active',
        trial_ends_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_config (user_id)
      )
    `);

    // Layer Designs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS layer_designs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sq VARCHAR(255) NOT NULL,
        design_name VARCHAR(255) NULL,
        product_type ENUM('2d', '3d') DEFAULT '2d',
        tab_settings JSON DEFAULT ('{"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true}'),
        layers_design JSON,
        customizable_data JSON DEFAULT ('[]'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create default superadmin user if not exists
    const [existingUsers] = await connection.execute('SELECT id FROM users WHERE role = "superadmin" LIMIT 1');
    if (existingUsers.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.execute(`
        INSERT INTO users (name, email, password, role, active) 
        VALUES (?, ?, ?, 'superadmin', TRUE)
      `, ['Super Admin', 'admin@kusheldigi.com', hashedPassword]);
      console.log('Default superadmin created: admin@kusheldigi.com / admin123');
    }

    connection.release();
    console.log('MySQL tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Initialize database
// createTables(); // Commented out as per user request - no new table creation needed

// Test endpoint to add sample data
app.post('/api/test/add-design', async (req, res) => {
  try {
    const sampleLayersDesign = {
      layers: [
        {
          id: 1,
          name: "Background",
          type: "image",
          url: "https://cloudinary.com/image1.jpg",
          position: { x: 0, y: 0 },
          size: { width: 500, height: 300 }
        },
        {
          id: 2,
          name: "Text Layer",
          type: "text",
          content: "Custom Text",
          font: "Arial",
          color: "#000000",
          position: { x: 100, y: 50 }
        },
        {
          id: 3,
          name: "Logo",
          type: "image",
          url: "https://cloudinary.com/logo.jpg",
          position: { x: 200, y: 150 },
          size: { width: 100, height: 100 }
        }
      ],
      canvas: {
        width: 800,
        height: 600,
        background: "#ffffff"
      }
    };

    const [result] = await pool.execute(
      'INSERT INTO layer_designs (user_id, sq, design_name, layers_design, customizable_data) VALUES (?, ?, ?, ?, ?)',
      [1, 'shirt', 'Sample Design with Layers', JSON.stringify(sampleLayersDesign), JSON.stringify([])]
    );
    res.json({ message: 'Test design with layers added', id: result.insertId, layersDesign: sampleLayersDesign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add test design', details: err.message });
  }
});

// Update existing design with sample layers
app.post('/api/test/update-design/:id', async (req, res) => {
  try {
    const sampleLayersDesign = {
      layers: [
        {
          id: 1,
          name: "Background",
          type: "image",
          url: "https://cloudinary.com/image1.jpg",
          position: { x: 0, y: 0 },
          size: { width: 500, height: 300 }
        },
        {
          id: 2,
          name: "Text Layer",
          type: "text",
          content: "Custom Text",
          font: "Arial",
          color: "#000000",
          position: { x: 100, y: 50 }
        },
        {
          id: 3,
          name: "Logo",
          type: "image",
          url: "https://cloudinary.com/logo.jpg",
          position: { x: 200, y: 150 },
          size: { width: 100, height: 100 }
        }
      ],
      canvas: {
        width: 800,
        height: 600,
        background: "#ffffff"
      }
    };

    const [result] = await pool.execute(
      'UPDATE layer_designs SET layers_design = ? WHERE id = ?',
      [JSON.stringify(sampleLayersDesign), req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Design not found' });
    }
    
    res.json({ message: 'Design updated with sample layers', layersDesign: sampleLayersDesign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update design', details: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World - MySQL Version");
});

// OTP storage (in production, use Redis or database table)
const otpStore = new Map();

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 465,
  secure: true,
  auth: {
    user: 'info@kusheldigi.com',
    pass: 'Kusheldigiinfopass',
  },
  from: 'info@kusheldigi.com',
  tls: {
    rejectUnauthorized: false,
  },
});

// Send OTP via email
async function sendOTP(email, otp) {
  try {
    await transporter.sendMail({
      from: 'info@kusheldigi.com',
      to: email,
      subject: 'Login OTP Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #333; text-align: center;">Login Verification</h2>
          <p style="color: #666; font-size: 16px;">Your login verification code is:</p>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// Auth middleware
function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = decoded.userId;
    req.storeHash = decoded.storeHash;
    
    // Get user role from database
    try {
      const [users] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
      if (users.length > 0) {
        req.userRole = users[0].role;
      } else {
        req.userRole = 'superadmin'; // Default fallback
      }
    } catch (error) {
      req.userRole = 'superadmin'; // Default fallback
    }
    
    next();
  });
}

// Helper middleware to check for superadmin or mastersuperadmin
async function requireSuperAdmin(req, res, next) {
  try {
    const [users] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (users.length === 0 || (users[0].role !== 'superadmin' && users[0].role !== 'mastersuperadmin')) {
      return res.status(403).json({ error: 'Only superadmin or mastersuperadmin can perform this action' });
    }
    next();
  } catch (error) {
    res.status(403).json({ error: 'Only superadmin or mastersuperadmin can perform this action' });
  }
}

// Helper middleware to check for mastersuperadmin only
async function requireMasterSuperAdmin(req, res, next) {
  try {
    const [users] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (users.length === 0 || users[0].role !== 'mastersuperadmin') {
      return res.status(403).json({ error: 'Only mastersuperadmin can perform this action' });
    }
    next();
  } catch (error) {
    res.status(403).json({ error: 'Only mastersuperadmin can perform this action' });
  }
}

// PRODUCT ENDPOINTS
// POST endpoint to save product customization
app.post('/api/save-product', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'INSERT INTO products (product_data) VALUES (?)',
      [JSON.stringify(req.body)]
    );
    res.status(201).json({ 
      message: 'Product saved successfully!', 
      product: { id: result.insertId, ...req.body } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save product', details: err.message });
  }
});

// GET endpoint to fetch all products
app.get('/api/products', auth, async (req, res) => {
  try {
    let query = 'SELECT * FROM products';
    let params = [];
    
    // If user is mastersuperadmin, show all products from all storeHash
    // If user is superadmin, show only their storeHash products
    if (req.userRole === 'mastersuperadmin') {
      query += ' ORDER BY createdAt DESC';
    } else {
      query += ' WHERE storeHash = ? ORDER BY createdAt DESC';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    const formattedProducts = products.map(product => {
      let tabSettings = {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true};
      let customizableData = [];
      
      // Safely parse tabSettings
      if (product.tabSettings) {
        try {
          let cleanTabSettings = product.tabSettings.toString().trim();
          if (cleanTabSettings.startsWith("'") && cleanTabSettings.endsWith("'")) {
            cleanTabSettings = cleanTabSettings.slice(1, -1);
          }
          tabSettings = JSON.parse(cleanTabSettings);
        } catch (parseError) {
          console.log('Error parsing tabSettings for product', product.id, ':', parseError.message);
        }
      }
      
      // Safely parse customizableData
      if (product.customizableData) {
        try {
          let cleanCustomizableData = product.customizableData.toString().trim();
          if (cleanCustomizableData.startsWith("'") && cleanCustomizableData.endsWith("'")) {
            cleanCustomizableData = cleanCustomizableData.slice(1, -1);
          }
          customizableData = JSON.parse(cleanCustomizableData);
        } catch (parseError) {
          console.log('Error parsing customizableData for product', product.id, ':', parseError.message);
        }
      }
      
      return {
      id: product.id,
        productSku: product.productSku,
        productName: product.productName,
        productImage: product.productImage,
        productType: product.ProductType,
        tabSettings: tabSettings,
        customizableData: customizableData,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });
    res.status(200).json(formattedProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// GET endpoint to fetch a specific product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const [products] = await pool.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = {
      id: products[0].id,
      ...JSON.parse(products[0].product_data),
      created_at: products[0].created_at,
      updated_at: products[0].updated_at
    };
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product', details: err.message });
  }
});

// AUTH ENDPOINTS
// Request OTP for login
app.post('/api/request-otp', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Check if user exists in loginMaster table
    const [users] = await pool.execute('SELECT * FROM loginMaster WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    
    const user = users[0];
    
    // If password is null (initial state), return invalid credentials
    if (user.password === null) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    
    // If password is not null, verify it
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate OTP using existing function
    const otp = generateOTP();

    // Store OTP in memory (in production, use Redis or database)
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    otpStore.set(email, {
      otp,
      userId: user.id,
      expiry: otpExpiry
    });

    // Send OTP via email using existing function
    const emailSent = await sendOTP(email, otp);
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }

    res.status(200).json({ 
      message: 'OTP sent successfully to your email',
      email: email 
    });
  } catch (err) {
    console.error('Error in request-otp:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and complete login
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  
  try {
    const storedData = otpStore.get(email);
    
    if (!storedData) {
      return res.status(400).json({ error: 'OTP expired or not found. Please request a new OTP.' });
    }

    // Check if OTP is expired
    if (new Date() > storedData.expiry) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    // Get user data from loginMaster table
    const [users] = await pool.execute('SELECT * FROM loginMaster WHERE id = ?', [storedData.userId]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }

    const user = users[0];

    // Check subscription status - only allow login if subscription is active (1)
    if (user.subscription !== 1) {
      return res.status(403).json({ 
        error: 'Your subscription is inactive. Please contact administrator to activate your account.' 
      });
    }

    // Generate JWT token with storeHash and role
    const token = jwt.sign({ userId: user.id, storeHash: user.storeHash, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    
    // Clear OTP from store
    otpStore.delete(email);

    res.status(200).json({ 
      message: 'Login successful', 
      token, 
      user: { 
        name: user.userName || user.email, 
        email: user.email, 
        phone: user.phone || '', 
        id: user.id, 
        role: user.role || 'superadmin' // Default to superadmin
      } 
    });

  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Clean expired OTPs every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiry) {
      otpStore.delete(email);
    }
  }
}, 5 * 60 * 1000);

// Login API endpoint (now deprecated - use OTP flow instead)
app.post('/api/login', async (req, res) => {
  res.status(400).json({ 
    error: 'Please use OTP verification. Use /api/request-otp first, then /api/verify-otp.' 
  });
});

// USER MANAGEMENT ENDPOINTS
// User registration API endpoint (only superadmin)
app.post('/api/register', auth, async (req, res) => {
  try {
    // Only superadmin or mastersuperadmin can register users
    const [currentUsers] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (currentUsers.length === 0 || (currentUsers[0].role !== 'superadmin' && currentUsers[0].role !== 'mastersuperadmin')) {
      return res.status(403).json({ error: 'Only superadmin or mastersuperadmin can register users.' });
    }

    const { name, email, phone, role } = req.body;
    
    // Check if user already exists
    const [existingUsers] = await pool.execute('SELECT id FROM loginMaster WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate unique userId and storeHash
    const userId = Math.floor(Math.random() * 10000000) + 1000000;
    const storeHash = Math.random().toString(36).substring(2, 12);
    const accessToken = Math.random().toString(36).substring(2, 32);
    
    const [result] = await pool.execute(
      'INSERT INTO loginMaster (email, password, userId, userName, storeHash, accessToken, subscription, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [email, null, userId, name || email, storeHash, accessToken, 0, role || 'superadmin']
    );

    // Send onboarding email
    await transporter.sendMail({
      from: 'info@kusheldigi.com',
      to: email,
      subject: 'Welcome to the Platform',
      html: `<h2>Welcome, ${name || email}!</h2><p>Your account has been created.</p><p><b>Email:</b> ${email}</p><p>Please use the forgot password feature to set your password.</p>`
    });

    res.status(201).json({ 
      message: 'User registered successfully', 
      user: { id: result.insertId, name: name || email, email, phone: phone || '', role: role || 'superadmin' } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get all users (superadmin only)
app.get('/api/users', auth, async (req, res) => {
  try {
    const [currentUsers] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (currentUsers.length === 0 || (currentUsers[0].role !== 'superadmin' && currentUsers[0].role !== 'mastersuperadmin')) {
      return res.status(403).json({ error: 'Only superadmin or mastersuperadmin can view users.' });
    }

    const [users] = await pool.execute('SELECT id, email, userName as name, role, createdAt as created_at, updatedAt as updated_at FROM loginMaster');
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Update user (superadmin only)
app.put('/api/users/:id', auth, async (req, res) => {
  try {
    const [currentUsers] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (currentUsers.length === 0 || (currentUsers[0].role !== 'superadmin' && currentUsers[0].role !== 'mastersuperadmin')) {
      return res.status(403).json({ error: 'Only superadmin or mastersuperadmin can update users.' });
    }

    const { name, email, phone, password } = req.body;
    let query = 'UPDATE loginMaster SET userName = ?, email = ?, phoneNumber = ?';
    let params = [name, email, phone];
    let passwordChanged = false;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
      passwordChanged = true;
    }

    query += ' WHERE id = ?';
    params.push(req.params.id);

    await pool.execute(query, params);

    const [users] = await pool.execute(
      'SELECT id, userName as name, email, phoneNumber as phone, role, subscription as active, createdAt as created_at, updatedAt as updated_at FROM loginMaster WHERE id = ?', 
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Send update email if password changed
    if (passwordChanged) {
      await transporter.sendMail({
        from: 'info@kusheldigi.com',
        to: user.email,
        subject: 'Your Account Updated',
        html: `<h2>Hello, ${user.name}!</h2><p>Your account details have been updated.</p><p><b>Email:</b> ${user.email}<br/><b>New Password:</b> ${password}</p>`
      });
    }

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// Activate/Deactivate user (superadmin only)
app.patch('/api/users/:id/active', auth, async (req, res) => {
  try {
    const [currentUsers] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (currentUsers.length === 0 || (currentUsers[0].role !== 'superadmin' && currentUsers[0].role !== 'mastersuperadmin')) {
      return res.status(403).json({ error: 'Only superadmin or mastersuperadmin can change user status.' });
    }

    const { active } = req.body;
    await pool.execute('UPDATE loginMaster SET subscription = ? WHERE id = ?', [active ? 1 : 0, req.params.id]);

    const [users] = await pool.execute(
      'SELECT id, userName as name, email, phoneNumber as phone, role, subscription as active, createdAt as created_at, updatedAt as updated_at FROM loginMaster WHERE id = ?', 
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ 
      message: `User ${active ? 'activated' : 'deactivated'} successfully`, 
      user: users[0] 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change user status', details: err.message });
  }
});

// Delete user (superadmin only)
app.delete('/api/users/:id', auth, async (req, res) => {
  try {
    const [currentUsers] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (currentUsers.length === 0 || (currentUsers[0].role !== 'superadmin' && currentUsers[0].role !== 'mastersuperadmin')) {
      return res.status(403).json({ error: 'Only superadmin or mastersuperadmin can delete users.' });
    }

    const [users] = await pool.execute('SELECT email FROM loginMaster WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.execute('DELETE FROM loginMaster WHERE id = ?', [req.params.id]);
    res.status(200).json({ message: 'User deleted successfully', email: users[0].email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

// CONFIGURATION ENDPOINTS
// Create Configuration
app.post('/api/configurations', auth, async (req, res) => {
  try {
    // Check if user already has a configuration
    const [existingConfigs] = await pool.execute('SELECT id FROM configurations WHERE user_id = ?', [req.userId]);
    if (existingConfigs.length > 0) {
      return res.status(429).json({ error: 'You can only create one configuration.' });
    }

    // Set trialEndsAt to 7 days from now
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [result] = await pool.execute(
      'INSERT INTO configurations (user_id, store_id, store_url, store_access_token, store_endpoint, subscription, trial_ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.userId, req.body.storeId, req.body.storeUrl, req.body.storeAccessToken, req.body.storeEndpoint, 'active', trialEndsAt]
    );

    const [configs] = await pool.execute('SELECT * FROM configurations WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Configuration saved successfully!', config: configs[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save configuration', details: err.message });
  }
});

// Get all Configurations
app.get('/api/configurations', auth, async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM configurations WHERE user_id = ?', [req.userId]);
    res.status(200).json(configs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch configurations', details: err.message });
  }
});

// Get Configuration by ID
app.get('/api/configurations/:id', auth, async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM configurations WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (configs.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.status(200).json(configs[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch configuration', details: err.message });
  }
});

// Update Configuration by ID
app.put('/api/configurations/:id', auth, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE configurations SET store_id = ?, store_url = ?, store_access_token = ?, store_endpoint = ?, subscription = ? WHERE id = ? AND user_id = ?',
      [req.body.storeId, req.body.storeUrl, req.body.storeAccessToken, req.body.storeEndpoint, req.body.subscription, req.params.id, req.userId]
    );

    const [configs] = await pool.execute('SELECT * FROM configurations WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (configs.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    res.status(200).json({ message: 'Configuration updated successfully!', config: configs[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update configuration', details: err.message });
  }
});

// Delete Configuration by ID
app.delete('/api/configurations/:id', auth, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM configurations WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.status(200).json({ message: 'Configuration deleted successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete configuration', details: err.message });
  }
});

// Get all configurations for a specific user
app.get('/api/user/:userId/configurations', async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM configurations WHERE user_id = ?', [req.params.userId]);
    res.status(200).json(configs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user configurations', details: err.message });
  }
});

// Get configuration validity by storeId
app.get('/api/configuration/by-store/:storeId', async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT subscription FROM configurations WHERE store_id = ?', [req.params.storeId]);
    if (configs.length === 0) {
      return res.status(404).json({ subscribe: false });
    }
    if (configs[0].subscription === 'active') {
      return res.json({ subscribe: true });
    } else {
      return res.json({ subscribe: false });
    }
  } catch (err) {
    res.status(500).json({ subscribe: false });
  }
});

// LAYER DESIGN ENDPOINTS
// List all unique SQs for the user (now fetches from products table)
app.get('/api/layerdesigns/sqs', auth, async (req, res) => {
  try {
    let query = 'SELECT DISTINCT productSku FROM products';
    let params = [];
    
    // If user is mastersuperadmin, show all SQs from all storeHash
    // If user is superadmin, show only their storeHash SQs
    if (req.userRole === 'mastersuperadmin') {
      // No WHERE clause needed for mastersuperadmin
    } else {
      query += ' WHERE storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    res.json(products.map(row => row.productSku));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SQs', details: err.message });
  }
});

// List LayerDesigns by SQ (now fetches from products table)
app.get('/api/layerdesigns/by-sq/:sq', auth, async (req, res) => {
  try {
    console.log('Fetching designs for SQ:', req.params.sq, 'User ID:', req.userId);
    
    // Find the product by SKU in the products table
    let query = 'SELECT * FROM products WHERE productSku = ?';
    let params = [req.params.sq];
    
    // If user is mastersuperadmin, can access any product
    // If user is superadmin, can only access their storeHash products
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = products[0];
    
    // Parse layerDesign object safely
    let layerDesignObj = {};
    console.log('Raw layerDesign from DB:', product.layerDesign);
    if (product.layerDesign) {
      try {
        let cleanLayerDesign = product.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        const parsed = JSON.parse(cleanLayerDesign);
        // Ensure it's an object, not an array
        layerDesignObj = Array.isArray(parsed) ? {} : parsed;
        console.log('Parsed layerDesign object:', layerDesignObj);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', product.id, ':', parseError.message);
        layerDesignObj = {};
      }
    }
    
    // Parse tabSettings safely
    let tabSettings = {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true};
    if (product.tabSettings) {
      try {
        let cleanTabSettings = product.tabSettings.toString().trim();
        if (cleanTabSettings.startsWith("'") && cleanTabSettings.endsWith("'")) {
          cleanTabSettings = cleanTabSettings.slice(1, -1);
        }
        tabSettings = JSON.parse(cleanTabSettings);
      } catch (parseError) {
        console.log('Error parsing tabSettings for product', product.id, ':', parseError.message);
      }
    }
    
    // Return single product with all designs in layerDesign
    const singleProduct = {
      id: product.id,
      userId: product.userId,
      sq: product.productSku,
      productName: product.productName,
      productImage: product.productImage,
      productType: product.ProductType || '2d',
      tabSettings: tabSettings,
      layerDesign: layerDesignObj, // Return parsed layerDesign object
      customizerImage: product.customizerImage,
      modelFile: product.modelFile,
      visible: product.visible === 1,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
    
    console.log('Returning single product with layerDesign:', singleProduct);
    res.json(singleProduct); // Return single product
  } catch (err) {
    console.error('Error in by-sq endpoint:', err);
    res.status(500).json({ error: 'Failed to fetch LayerDesigns', details: err.message });
  }
});



// Update Product tabSettings, ProductType, and visibility (users can only edit these)
app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const { tabSettings, productType, visible } = req.body;
    
    // Get current product data
    let selectQuery = 'SELECT * FROM products WHERE id = ?';
    let selectParams = [req.params.id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      selectQuery += ' AND storeHash = ?';
      selectParams.push(req.storeHash);
    }
    
    const [products] = await pool.execute(selectQuery, selectParams);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let updateFields = [];
    let updateParams = [];
    
    if (tabSettings !== undefined) {
      updateFields.push('tabSettings = ?');
      // Check if tabSettings is already a string or needs to be stringified
      const tabSettingsValue = typeof tabSettings === 'string' ? tabSettings : JSON.stringify(tabSettings);
      updateParams.push(tabSettingsValue);
    }
    
    if (productType !== undefined) {
      updateFields.push('ProductType = ?');
      updateParams.push(productType);
    }
    
    if (visible !== undefined) {
      updateFields.push('visible = ?');
      updateParams.push(visible ? 1 : 0);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateParams.push(req.params.id);
    
    // Build UPDATE query with conditional storeHash restriction
    let updateQuery = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    // Update the product
    await pool.execute(updateQuery, updateParams);

    // Get the updated product to return
    let fetchQuery = 'SELECT * FROM products WHERE id = ?';
    let fetchParams = [req.params.id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      fetchQuery += ' AND storeHash = ?';
      fetchParams.push(req.storeHash);
    }
    
    const [updatedProducts] = await pool.execute(fetchQuery, fetchParams);
    const updatedProductData = updatedProducts[0];
    
    let tabSettingsParsed = {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true};
    let customizableDataParsed = [];
    
    // Safely parse tabSettings
    if (updatedProductData.tabSettings) {
      try {
        let cleanTabSettings = updatedProductData.tabSettings.toString().trim();
        if (cleanTabSettings.startsWith("'") && cleanTabSettings.endsWith("'")) {
          cleanTabSettings = cleanTabSettings.slice(1, -1);
        }
        tabSettingsParsed = JSON.parse(cleanTabSettings);
      } catch (parseError) {
        console.log('Error parsing tabSettings for product', updatedProductData.id, ':', parseError.message);
      }
    }
    
    // Safely parse customizableData
    if (updatedProductData.customizableData) {
      try {
        let cleanCustomizableData = updatedProductData.customizableData.toString().trim();
        if (cleanCustomizableData.startsWith("'") && cleanCustomizableData.endsWith("'")) {
          cleanCustomizableData = cleanCustomizableData.slice(1, -1);
        }
        customizableDataParsed = JSON.parse(cleanCustomizableData);
      } catch (parseError) {
        console.log('Error parsing customizableData for product', updatedProductData.id, ':', parseError.message);
      }
    }

    const updatedProduct = {
      id: updatedProductData.id,
      sq: updatedProductData.productSku,
      productName: updatedProductData.productName,
      productImage: updatedProductData.productImage,
      productType: updatedProductData.ProductType || '2d',
      tabSettings: tabSettingsParsed,
      customizableData: customizableDataParsed,
      visible: updatedProductData.visible === 1,
      createdAt: updatedProductData.createdAt,
      updatedAt: updatedProductData.updatedAt
    };

    res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update Product', details: err.message });
  }
});

// Create/Update Product design (store in layerDesign object)
app.post('/api/layerdesigns', auth, async (req, res) => {
  try {
    const { sq, designName, layersDesign, customizableData, productType, tabSettings } = req.body;
    console.log('Received data for new design:', req.body);

    // Find the product by SQ in the products table
    let query = 'SELECT * FROM products WHERE productSku = ?';
    let params = [sq];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = products[0];
    
    // If designName is provided, add/update design in layerDesign object
    if (designName && designName.trim()) {
      // Parse existing layerDesign object
      let layerDesignObj = {};
      if (product.layerDesign) {
        try {
          let cleanLayerDesign = product.layerDesign.toString().trim();
          if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
            cleanLayerDesign = cleanLayerDesign.slice(1, -1);
          }
          const parsed = JSON.parse(cleanLayerDesign);
          // Ensure it's an object, not an array
          layerDesignObj = Array.isArray(parsed) ? {} : parsed;
        } catch (parseError) {
          console.log('Error parsing layerDesign for product', product.id, ':', parseError.message);
          layerDesignObj = {};
        }
      }

      // Check if design name already exists
      if (layerDesignObj[designName.trim()]) {
        return res.status(400).json({ error: 'Design with this name already exists for this product' });
      }

      // Add new design to layerDesign object - only design name and customizable data
      layerDesignObj[designName.trim()] = customizableData || [];
      
      console.log('Updated layerDesign object:', layerDesignObj);
      console.log('Product ID:', product.id);
      console.log('Design name:', designName.trim());

      // Update the product with new layerDesign object
      let updateQuery = 'UPDATE products SET layerDesign = ? WHERE id = ?';
      let updateParams = [JSON.stringify(layerDesignObj), product.id];
      
      // Add storeHash restriction only for non-mastersuperadmin users
      if (req.userRole !== 'mastersuperadmin') {
        updateQuery += ' AND storeHash = ?';
        updateParams.push(req.storeHash);
      }
      
      console.log('Update query:', updateQuery);
      console.log('Update params:', updateParams);
      
      await pool.execute(updateQuery, updateParams);
      console.log('Database updated successfully');

      res.status(201).json({ 
        message: 'Design created successfully',
        designName: designName.trim(),
        productId: product.id,
        layerDesign: layerDesignObj
      });
     } else {
       res.status(400).json({ error: 'Design name is required' });
     }
   } catch (err) {
     console.error('Error creating design:', err);
     res.status(500).json({ error: 'Failed to create design', details: err.message });
   }
 });

// Get all Products for the logged-in user
app.get('/api/layerdesigns', auth, async (req, res) => {
  try {
    let query = 'SELECT * FROM products';
    let params = [];
    
    // If user is mastersuperadmin, show all products from all storeHash
    // If user is superadmin, show only their storeHash products
    if (req.userRole === 'mastersuperadmin') {
      query += ' ORDER BY createdAt DESC';
    } else {
      query += ' WHERE storeHash = ? ORDER BY createdAt DESC';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    const formattedProducts = products.map(product => {
      let tabSettings = {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true};
      let customizableData = [];
      
      // Safely parse tabSettings
      if (product.tabSettings) {
        try {
          // Clean the string first - remove any extra quotes or escape characters
          let cleanTabSettings = product.tabSettings.toString().trim();
          if (cleanTabSettings.startsWith("'") && cleanTabSettings.endsWith("'")) {
            cleanTabSettings = cleanTabSettings.slice(1, -1);
          }
          tabSettings = JSON.parse(cleanTabSettings);
        } catch (parseError) {
          console.log('Error parsing tabSettings for product', product.id, ':', parseError.message);
          // Use default tabSettings if parsing fails
        }
      }
      
      // Safely parse customizableData
      if (product.customizableData) {
        try {
          let cleanCustomizableData = product.customizableData.toString().trim();
          if (cleanCustomizableData.startsWith("'") && cleanCustomizableData.endsWith("'")) {
            cleanCustomizableData = cleanCustomizableData.slice(1, -1);
          }
          customizableData = JSON.parse(cleanCustomizableData);
        } catch (parseError) {
          console.log('Error parsing customizableData for product', product.id, ':', parseError.message);
          // Use empty array if parsing fails
        }
      }
      
      return {
        id: product.id,
        sq: product.productSku,
        productName: product.productName,
        productImage: product.productImage,
        customizerImage: product.customizerImage,
        modelFile: product.modelFile,
        productType: product.ProductType || '2d',
        tabSettings: tabSettings,
        customizableData: customizableData,
        visible: product.visible === 1,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });
    res.json(formattedProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Products', details: err.message });
  }
});

// Get a single Product by ID
app.get('/api/layerdesigns/:id', auth, async (req, res) => {
  try {
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [req.params.id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const productData = products[0];
    let tabSettings = {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true};
    let layerDesign = {};
    
    // Safely parse tabSettings
    if (productData.tabSettings) {
      try {
        let cleanTabSettings = productData.tabSettings.toString().trim();
        if (cleanTabSettings.startsWith("'") && cleanTabSettings.endsWith("'")) {
          cleanTabSettings = cleanTabSettings.slice(1, -1);
        }
        tabSettings = JSON.parse(cleanTabSettings);
      } catch (parseError) {
        console.log('Error parsing tabSettings for product', productData.id, ':', parseError.message);
      }
    }
    
    // Safely parse layerDesign
    if (productData.layerDesign) {
      try {
        let cleanLayerDesign = productData.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        layerDesign = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', productData.id, ':', parseError.message);
      }
    }

    const product = {
      id: productData.id,
      sq: productData.productSku,
      productName: productData.productName,
      productImage: productData.productImage,
      productType: productData.ProductType || '2d',
      tabSettings: tabSettings,
      layerDesign: layerDesign,
      createdAt: productData.createdAt,
      updatedAt: productData.updatedAt
    };

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Product', details: err.message });
  }
});

// Bulk update SQ for all LayerDesigns
app.put('/api/layerdesigns/bulk-update-sq', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { oldSq, newSq } = req.body;
    const [result] = await pool.execute(
      'UPDATE layer_designs SET sq = ? WHERE user_id = ? AND sq = ?', 
      [newSq, req.userId, oldSq]
    );
    res.json({ message: 'SQ updated', modifiedCount: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update SQ', details: err.message });
  }
});

// Bulk delete LayerDesigns by SQ
app.delete('/api/layerdesigns/by-sq/:sq', auth, requireSuperAdmin, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM layer_designs WHERE user_id = ? AND sq = ?', [req.userId, req.params.sq]);
    res.json({ message: 'LayerDesigns deleted', deletedCount: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete LayerDesigns', details: err.message });
  }
});

// Update a Product design (edit design name within layerDesign object)
app.put('/api/layerdesigns/:id', auth, async (req, res) => {
  try {
    const { sq, designName, newDesignName, customizableData } = req.body;
    
    // Get current product data
    let selectQuery = 'SELECT * FROM products WHERE id = ?';
    let selectParams = [req.params.id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      selectQuery += ' AND storeHash = ?';
      selectParams.push(req.storeHash);
    }
    
    const [products] = await pool.execute(selectQuery, selectParams);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = products[0];
    
    // Parse existing layerDesign object
    let layerDesignObj = {};
    if (product.layerDesign) {
      try {
        let cleanLayerDesign = product.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        layerDesignObj = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', product.id, ':', parseError.message);
        layerDesignObj = {};
      }
    }

    // If designName is provided, update the design name
    if (designName && newDesignName && designName !== newDesignName) {
      // Check if new design name already exists
      if (layerDesignObj[newDesignName.trim()]) {
        return res.status(400).json({ error: 'Design with this name already exists' });
      }

      // Move data from old design name to new design name
      if (layerDesignObj[designName]) {
        layerDesignObj[newDesignName.trim()] = layerDesignObj[designName];
        delete layerDesignObj[designName];
      }

      // Update the product with new layerDesign object
      let updateQuery = 'UPDATE products SET layerDesign = ? WHERE id = ?';
      let updateParams = [JSON.stringify(layerDesignObj), product.id];
      
      // Add storeHash restriction only for non-mastersuperadmin users
      if (req.userRole !== 'mastersuperadmin') {
        updateQuery += ' AND storeHash = ?';
        updateParams.push(req.storeHash);
      }
      
      await pool.execute(updateQuery, updateParams);

      res.json({ 
        message: 'Design updated successfully',
        oldDesignName: designName,
        newDesignName: newDesignName.trim()
      });
    } else {
      res.status(400).json({ error: 'Both designName and newDesignName are required for update' });
    }
  } catch (err) {
    console.error('Error updating design:', err);
    res.status(500).json({ error: 'Failed to update design', details: err.message });
  }
});

// Delete a Product Design (remove design from layerDesign object)
app.delete('/api/layerdesigns/:id', auth, async (req, res) => {
  try {
    const { designName } = req.body;
    
    if (!designName) {
      return res.status(400).json({ error: 'Design name is required for deletion' });
    }
    
    // Get current product data
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [req.params.id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = products[0];
    
    // Parse existing layerDesign object
    let layerDesignObj = {};
    if (product.layerDesign) {
      try {
        let cleanLayerDesign = product.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        layerDesignObj = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', product.id, ':', parseError.message);
        layerDesignObj = {};
      }
    }
    
    // Check if design exists
    if (!layerDesignObj[designName]) {
      return res.status(404).json({ error: 'Design not found' });
    }
    
    // Remove the design from layerDesign object
    delete layerDesignObj[designName];
    
    // Update the product with new layerDesign object
    let updateQuery = 'UPDATE products SET layerDesign = ? WHERE id = ?';
    let updateParams = [JSON.stringify(layerDesignObj), product.id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    await pool.execute(updateQuery, updateParams);
    
    res.json({ 
      message: 'Design deleted successfully',
      deletedDesignName: designName
    });
  } catch (err) {
    console.error('Error deleting design:', err);
    res.status(500).json({ error: 'Failed to delete design', details: err.message });
  }
});

// Delete customizable data from a Product
app.delete('/api/layerdesigns/:id/customize', auth, async (req, res) => {
  try {
    const { designName, deleteIndex } = req.body;
    
    // Get current product data
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [req.params.id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = products[0];
    
    // Parse current layerDesign object safely
    let layerDesignObj = {};
    if (product.layerDesign) {
      try {
        let cleanLayerDesign = product.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        layerDesignObj = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', req.params.id, ':', parseError.message);
        layerDesignObj = {};
      }
    }

    // Use designName as key, or default to 'default' if not provided
    const designKey = designName || 'default';
    
    // Check if design exists and has the item to delete
    if (!layerDesignObj[designKey] || !layerDesignObj[designKey][deleteIndex]) {
      return res.status(400).json({ error: 'Item not found for deletion' });
    }

    // Remove the item at the specified index
    layerDesignObj[designKey].splice(deleteIndex, 1);

    // Update the product with updated layerDesign object
    let updateQuery = 'UPDATE products SET layerDesign = ? WHERE id = ?';
    let updateParams = [JSON.stringify(layerDesignObj), req.params.id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    await pool.execute(updateQuery, updateParams);

    res.status(200).json({ 
      message: 'Customizable data deleted successfully',
      remainingItems: layerDesignObj[designKey].length
    });

  } catch (err) {
    console.error('Error deleting customizable data:', err);
    res.status(500).json({ error: 'Failed to delete customizable data', details: err.message });
  }
});

// Add customizable data to a Product (organized by design names in layerDesign)
app.post('/api/layerdesigns/:id/customize', auth, async (req, res) => {
  try {
    const { title, shortDescription, price, files, designName, editIndex } = req.body;
    
    // Get current product data
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [req.params.id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = products[0];
    
    // Parse current layerDesign object safely
    let layerDesignObj = {};
    if (product.layerDesign) {
      try {
        let cleanLayerDesign = product.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        layerDesignObj = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', req.params.id, ':', parseError.message);
        layerDesignObj = {};
      }
    }

    // Use designName as key, or default to 'default' if not provided
    const designKey = designName || 'default';
    
    // Initialize design if it doesn't exist
    if (!layerDesignObj[designKey]) {
      layerDesignObj[designKey] = [];
    }

    // Handle edit or add operation
    if (editIndex !== null && editIndex !== undefined) {
      // Update existing item
      if (layerDesignObj[designKey][editIndex]) {
        layerDesignObj[designKey][editIndex] = { title, shortDescription, price: price || 0.0, files };
      } else {
        return res.status(400).json({ error: 'Invalid edit index' });
      }
    } else {
      // Add new customizable data to the specific design
      layerDesignObj[designKey].push({ title, shortDescription, price: price || 0.0, files });
    }

    // Update the product with new layerDesign object
    let updateQuery = 'UPDATE products SET layerDesign = ? WHERE id = ?';
    let updateParams = [JSON.stringify(layerDesignObj), req.params.id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    await pool.execute(updateQuery, updateParams);

    // Get the updated product
    let fetchQuery = 'SELECT * FROM products WHERE id = ?';
    let fetchParams = [req.params.id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      fetchQuery += ' AND storeHash = ?';
      fetchParams.push(req.storeHash);
    }
    
    const [updatedProducts] = await pool.execute(fetchQuery, fetchParams);
    const updatedProduct = updatedProducts[0];
    
    // Parse the updated layerDesign object safely
    let updatedLayerDesignObj = {};
    if (updatedProduct.layerDesign) {
      try {
        let cleanLayerDesign = updatedProduct.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        updatedLayerDesignObj = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing updated layerDesign for product', updatedProduct.id, ':', parseError.message);
        updatedLayerDesignObj = {};
      }
    }

    // Create a layerDesign object that matches the expected format
    const layerDesign = {
      id: updatedProduct.id,
      user_id: req.userId,
      sq: updatedProduct.productSku,
      design_name: designName || 'default',
      product_type: updatedProduct.ProductType || '2d',
      tab_settings: JSON.stringify({"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true}),
      layers_design: updatedProduct.layerDesign ? JSON.stringify(updatedProduct.layerDesign) : null,
      customizable_data: JSON.stringify(updatedLayerDesignObj[designKey] || []),
      created_at: updatedProduct.createdAt,
      updated_at: updatedProduct.updatedAt,
      // Add the formatted fields for frontend compatibility
      designName: designName || 'default',
      productType: updatedProduct.ProductType || '2d',
      tabSettings: {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true},
      layersDesign: updatedProduct.layerDesign || null,
      customizableData: updatedLayerDesignObj[designKey] || []
    };

    res.json({ message: 'Customizable data added successfully', layerDesign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add customizable data', details: err.message });
  }
});

// UPLOAD ENDPOINT
app.post('/api/upload', auth, requireSuperAdmin, upload.single('image'), async (req, res) => {
  try {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'customizer' },
      (error, result) => {
        if (error) return res.status(500).json({ error: 'Cloudinary upload failed', details: error });
        res.json({ url: result.secure_url });
      }
    );
    stream.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// PASSWORD RESET ENDPOINTS
// Forgot password - Request reset
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    // Check if user exists in loginMaster table
    const [users] = await pool.execute('SELECT * FROM loginMaster WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'No account found with this email address' });
    }

    const user = users[0];

    // Since we don't have active field in loginMaster, we skip that check

    // Generate reset token
    const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    
    // Store reset token with expiry
    otpStore.set(`reset_${email}`, {
      token: resetToken,
      expiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      userId: user.id
    });

    // Create reset link
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send reset email
    const emailSent = await transporter.sendMail({
      from: 'info@kusheldigi.com',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
          <p style="color: #666; font-size: 16px;">Hello ${user.name},</p>
          <p style="color: #666; font-size: 16px;">You have requested to reset your password. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you didn't request this password reset, please ignore this email.</p>
        </div>
      `
    });

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    res.status(200).json({ 
      message: 'Password reset link sent to your email',
      email: email 
    });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Verify reset token
app.post('/api/verify-reset-token', async (req, res) => {
  const { token, email } = req.body;
  
  try {
    const storedData = otpStore.get(`reset_${email}`);
    
    if (!storedData) {
      return res.status(400).json({ error: 'Reset link expired or not found.' });
    }

    // Check if token is expired
    if (new Date() > storedData.expiry) {
      otpStore.delete(`reset_${email}`);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    // Verify token
    if (storedData.token !== token) {
      return res.status(400).json({ error: 'Invalid reset link.' });
    }

    res.status(200).json({ 
      message: 'Token verified successfully',
      valid: true
    });

  } catch (err) {
    console.error('Token verification error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  const { token, email, newPassword, confirmPassword } = req.body;
  
  try {
    // Validate passwords
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const storedData = otpStore.get(`reset_${email}`);
    
    if (!storedData) {
      return res.status(400).json({ error: 'Reset link expired or not found.' });
    }

    // Check if token is expired
    if (new Date() > storedData.expiry) {
      otpStore.delete(`reset_${email}`);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    // Verify token
    if (storedData.token !== token) {
      return res.status(400).json({ error: 'Invalid reset link.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password in loginMaster table
    await pool.execute('UPDATE loginMaster SET password = ? WHERE id = ?', [hashedPassword, storedData.userId]);

    // Clear reset token
    otpStore.delete(`reset_${email}`);

    res.status(200).json({ 
      message: 'Password reset successfully'
    });

  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// CRON JOBS
// CRON JOB: Deactivate subscription after trial
cron.schedule('0 0 * * *', async () => {
  // Runs every day at midnight
  const now = new Date();
  console.log('Running subscription deactivation cron job at:', now);
  
  try {
    // Update Configuration model subscriptions
    const [result] = await pool.execute(
      'UPDATE configurations SET subscription = ? WHERE trial_ends_at <= ? AND subscription = ?', 
      ['inactive', now, 'active']
    );
    
    console.log(`Deactivated ${result.affectedRows} expired subscriptions`);
  } catch (error) {
    console.error('Error in subscription deactivation cron job:', error);
  }
});

// Manual API to deactivate expired subscriptions
app.post('/api/deactivate-expired-subscriptions', auth, async (req, res) => {
  try {
    const [currentUsers] = await pool.execute('SELECT role FROM loginMaster WHERE id = ?', [req.userId]);
    if (currentUsers.length === 0 || (currentUsers[0].role !== 'superadmin' && currentUsers[0].role !== 'mastersuperadmin')) {
      return res.status(403).json({ error: 'Only superadmin or mastersuperadmin can perform this action.' });
    }

    const now = new Date();
    const [result] = await pool.execute(
      'UPDATE configurations SET subscription = ? WHERE trial_ends_at <= ? AND subscription = ?', 
      ['inactive', now, 'active']
    );

    res.status(200).json({ 
      message: `Deactivated ${result.affectedRows} expired subscriptions`,
      deactivatedCount: result.affectedRows,
      currentTime: now
    });
  } catch (err) {
    console.error('Error deactivating expired subscriptions:', err);
    res.status(500).json({ error: 'Failed to deactivate expired subscriptions', details: err.message });
  }
});

// SUBSCRIPTION MANAGEMENT APIs (MasterSuperAdmin only)

// Get all subscriptions with storeHash info
app.get('/api/subscription-management', auth, requireMasterSuperAdmin, async (req, res) => {
  try {
    // Get all users from loginMaster except mastersuperadmin
    const [users] = await pool.execute(`
      SELECT 
        id,
        email,
        userName,
        storeHash,
        subscription as isActive,
        role,
        createdAt,
        updatedAt
      FROM loginMaster 
      WHERE role != 'mastersuperadmin'
      ORDER BY updatedAt DESC
    `);

    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching users for subscription management:', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Toggle subscription status by storeHash
app.post('/api/subscription-management/toggle', auth, requireMasterSuperAdmin, async (req, res) => {
  try {
    const { storeHash, isActive } = req.body;
    const now = new Date();

    if (!storeHash) {
      return res.status(400).json({ error: 'storeHash is required' });
    }

    // Update loginMaster table subscription field
    await pool.execute(
      'UPDATE loginMaster SET subscription = ?, updatedAt = ? WHERE storeHash = ?',
      [isActive ? 1 : 0, now, storeHash]
    );

    // Always insert a new record into subscriptions table for history tracking
    await pool.execute(
      'INSERT INTO subscriptions (storeHash, isActive, updatedAt) VALUES (?, ?, ?)',
      [storeHash, isActive ? 1 : 0, now]
    );

    // Get updated user data
    const [updatedUser] = await pool.execute(`
      SELECT 
        id,
        email,
        userName,
        storeHash,
        subscription as isActive,
        role,
        createdAt,
        updatedAt
      FROM loginMaster 
      WHERE storeHash = ?
    `, [storeHash]);

    res.status(200).json({
      message: `Subscription ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: updatedUser[0],
      updatedAt: now
    });
  } catch (err) {
    console.error('Error toggling subscription:', err);
    res.status(500).json({ error: 'Failed to toggle subscription', details: err.message });
  }
});

// Get subscription history for a specific storeHash
app.get('/api/subscription-management/history/:storeHash', auth, requireMasterSuperAdmin, async (req, res) => {
  try {
    const { storeHash } = req.params;

    const [history] = await pool.execute(
      'SELECT id, storeHash, isActive, updatedAt FROM subscriptions WHERE storeHash = ? ORDER BY updatedAt DESC',
      [storeHash]
    );

    // Format the history data for better readability
    const formattedHistory = history.map(record => ({
      id: record.id,
      storeHash: record.storeHash,
      status: record.isActive ? 'Active' : 'Inactive',
      isActive: record.isActive,
      changedAt: record.updatedAt,
      action: record.isActive ? 'Activated' : 'Deactivated'
    }));

    res.status(200).json({
      storeHash,
      totalChanges: history.length,
      history: formattedHistory
    });
  } catch (err) {
    console.error('Error fetching subscription history:', err);
    res.status(500).json({ error: 'Failed to fetch subscription history', details: err.message });
  }
});

// Upload customizer image for a product
app.post('/api/products/:id/customizer-image', auth, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if product exists and belongs to user
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'customizer-images',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    // Update product with customizer image URL
    let updateQuery = 'UPDATE products SET customizerImage = ? WHERE id = ?';
    let updateParams = [result.secure_url, id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    await pool.execute(updateQuery, updateParams);

    res.status(200).json({ 
      message: 'Customizer image uploaded successfully',
      imageUrl: result.secure_url
    });

  } catch (err) {
    console.error('Error uploading customizer image:', err);
    res.status(500).json({ error: 'Failed to upload customizer image', details: err.message });
  }
});

// Update or remove customizer image for a product
app.put('/api/products/:id/customizer-image', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { customizerImage } = req.body;
    
    // Check if product exists and belongs to user
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product with customizer image URL (or null to remove)
    let updateQuery = 'UPDATE products SET customizerImage = ? WHERE id = ?';
    let updateParams = [customizerImage, id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    await pool.execute(updateQuery, updateParams);

    res.status(200).json({ 
      message: customizerImage ? 'Customizer image updated successfully' : 'Customizer image removed successfully',
      imageUrl: customizerImage
    });

  } catch (err) {
    console.error('Error updating customizer image:', err);
    res.status(500).json({ error: 'Failed to update customizer image', details: err.message });
  }
});

// Upload 3D model file for a product
app.post('/api/products/:id/3d-model', auth, upload.single('model'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if product exists and belongs to user
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product is 3D
    if (products[0].ProductType !== '3d') {
      return res.status(400).json({ error: 'This product is not a 3D product. Only 3D products can have model files.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No model file provided' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: '3d-models',
          resource_type: 'raw', // For model files like .glb, .obj, etc.
          public_id: `${Date.now()}_${req.file.originalname.replace(/\.[^/.]+$/, '')}`, // Preserve original filename without extension
          format: req.file.originalname.split('.').pop(), // Preserve file extension
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    // Update product with 3D model URL
    let updateQuery = 'UPDATE products SET modelFile = ? WHERE id = ?';
    let updateParams = [result.secure_url, id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    await pool.execute(updateQuery, updateParams);

    res.status(200).json({ 
      message: '3D model uploaded successfully',
      modelUrl: result.secure_url,
      fileName: req.file.originalname
    });

  } catch (err) {
    console.error('Error uploading 3D model:', err);
    res.status(500).json({ error: 'Failed to upload 3D model', details: err.message });
  }
});

// Update or remove 3D model file for a product
app.put('/api/products/:id/3d-model', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { modelFile } = req.body;
    
    // Check if product exists and belongs to user
    let query = 'SELECT * FROM products WHERE id = ?';
    let params = [id];
    
    // If user is mastersuperadmin, allow access to any product
    // If user is superadmin, restrict to their storeHash
    if (req.userRole !== 'mastersuperadmin') {
      query += ' AND storeHash = ?';
      params.push(req.storeHash);
    }
    
    const [products] = await pool.execute(query, params);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product with 3D model URL (or null to remove)
    let updateQuery = 'UPDATE products SET modelFile = ? WHERE id = ?';
    let updateParams = [modelFile, id];
    
    // Add storeHash restriction only for non-mastersuperadmin users
    if (req.userRole !== 'mastersuperadmin') {
      updateQuery += ' AND storeHash = ?';
      updateParams.push(req.storeHash);
    }
    
    await pool.execute(updateQuery, updateParams);

    res.status(200).json({ 
      message: modelFile ? '3D model updated successfully' : '3D model removed successfully',
      modelUrl: modelFile
    });

  } catch (err) {
    console.error('Error updating 3D model:', err);
    res.status(500).json({ error: 'Failed to update 3D model', details: err.message });
  }
});

// Developer API to fetch product data by productId and storeHash
app.get('/api/developer/product', async (req, res) => {
  try {
    const { productId, storeHash } = req.query;
    
    if (!productId || !storeHash) {
      return res.status(400).json({ 
        status: false,
        error: 'productId and storeHash are required' 
      });
    }

    // Fetch product data
    const [products] = await pool.execute(
      'SELECT * FROM products WHERE productId = ? AND storeHash = ?', 
      [productId, storeHash]
    );

    if (products.length === 0) {
      return res.status(404).json({ 
        status: false,
        error: 'Product not found' 
      });
    }

    const product = products[0];

    // Check if product is visible
    if (product.visible !== 1) {
      return res.status(404).json({ 
        status: false,
        error: 'Product is not visible' 
      });
    }

    // Parse JSON fields safely
    let tabSettings = {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true};
    let customizableData = [];
    let layerDesign = {};
    
    if (product.tabSettings) {
      try {
        let cleanTabSettings = product.tabSettings.toString().trim();
        if (cleanTabSettings.startsWith("'") && cleanTabSettings.endsWith("'")) {
          cleanTabSettings = cleanTabSettings.slice(1, -1);
        }
        tabSettings = JSON.parse(cleanTabSettings);
      } catch (parseError) {
        console.log('Error parsing tabSettings for product', product.id, ':', parseError.message);
      }
    }
    
    if (product.customizableData) {
      try {
        let cleanCustomizableData = product.customizableData.toString().trim();
        if (cleanCustomizableData.startsWith("'") && cleanCustomizableData.endsWith("'")) {
          cleanCustomizableData = cleanCustomizableData.slice(1, -1);
        }
        customizableData = JSON.parse(cleanCustomizableData);
      } catch (parseError) {
        console.log('Error parsing customizableData for product', product.id, ':', parseError.message);
      }
    }

    if (product.layerDesign) {
      try {
        let cleanLayerDesign = product.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        layerDesign = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', product.id, ':', parseError.message);
      }
    }

    // Return product data excluding specified fields
    const responseData = {
      status: true,
      data: {
        ProductType: product.ProductType || '2d',
        tabSettings: tabSettings,
        customizableData: customizableData,
        customizerImage: product.customizerImage,
        modelFile: product.modelFile,
        designName: product.designName,
        layerDesign: layerDesign
      }
    };

    res.status(200).json(responseData);

  } catch (err) {
    console.error('Error fetching product for developer:', err);
    res.status(500).json({ 
      status: false,
      error: 'Failed to fetch product data', 
      details: err.message 
    });
  }
});

// Developer API to fetch product data by SQ (productSku) and storeHash
app.get('/api/developer/product-by-sq', async (req, res) => {
  try {
    const { sq, storeHash } = req.query;
    
    if (!sq || !storeHash) {
      return res.status(400).json({ 
        status: false,
        error: 'sq and storeHash are required' 
      });
    }

    // Fetch product data by SQ
    const [products] = await pool.execute(
      'SELECT * FROM products WHERE productSku = ? AND storeHash = ?', 
      [sq, storeHash]
    );

    if (products.length === 0) {
      return res.status(404).json({ 
        status: false,
        error: 'Product not found' 
      });
    }

    const product = products[0];

    // Check if product is visible
    if (product.visible !== 1) {
      return res.status(404).json({ 
        status: false,
        error: 'Product is not visible' 
      });
    }

    // Parse JSON fields safely
    let tabSettings = {"aiEditor": true, "imageEdit": true, "textEdit": true, "colors": true, "clipart": true};
    let customizableData = [];
    let layerDesign = {};
    
    if (product.tabSettings) {
      try {
        let cleanTabSettings = product.tabSettings.toString().trim();
        if (cleanTabSettings.startsWith("'") && cleanTabSettings.endsWith("'")) {
          cleanTabSettings = cleanTabSettings.slice(1, -1);
        }
        tabSettings = JSON.parse(cleanTabSettings);
      } catch (parseError) {
        console.log('Error parsing tabSettings for product', product.id, ':', parseError.message);
      }
    }
    
    if (product.customizableData) {
      try {
        let cleanCustomizableData = product.customizableData.toString().trim();
        if (cleanCustomizableData.startsWith("'") && cleanCustomizableData.endsWith("'")) {
          cleanCustomizableData = cleanCustomizableData.slice(1, -1);
        }
        customizableData = JSON.parse(cleanCustomizableData);
      } catch (parseError) {
        console.log('Error parsing customizableData for product', product.id, ':', parseError.message);
      }
    }

    if (product.layerDesign) {
      try {
        let cleanLayerDesign = product.layerDesign.toString().trim();
        if (cleanLayerDesign.startsWith("'") && cleanLayerDesign.endsWith("'")) {
          cleanLayerDesign = cleanLayerDesign.slice(1, -1);
        }
        layerDesign = JSON.parse(cleanLayerDesign);
      } catch (parseError) {
        console.log('Error parsing layerDesign for product', product.id, ':', parseError.message);
      }
    }

    // Return product data excluding specified fields
    const responseData = {
      status: true,
      data: {
        ProductType: product.ProductType || '2d',
        tabSettings: tabSettings,
        customizableData: customizableData,
        customizerImage: product.customizerImage,
        modelFile: product.modelFile,
        designName: product.designName,
        layerDesign: layerDesign
      }
    };

    res.status(200).json(responseData);

  } catch (err) {
    console.error('Error fetching product by SQ for developer:', err);
    res.status(500).json({ 
      status: false,
      error: 'Failed to fetch product data', 
      details: err.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('MySQL database connected successfully');
}); 