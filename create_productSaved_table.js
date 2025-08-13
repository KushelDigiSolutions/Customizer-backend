const mysql = require('mysql2/promise');

async function createProductSavedTable() {
  const connection = await mysql.createConnection({
    host: '13.201.29.82',
    user: 'admin_customiser',
    password: 'Chirag@2025',
    database: 'admin_customiser'
  });

  try {
    // Drop existing table if exists
    await connection.execute('DROP TABLE IF EXISTS productSaved');
    console.log('🗑️ Dropped existing productSaved table');

    // Create productSaved table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS productSaved (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_data JSON NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await connection.execute(createTableQuery);
    console.log('✅ productSaved table created successfully!');

    // Show table structure
    const [columns] = await connection.execute('DESCRIBE productSaved');
    console.log('\n📋 Table Structure:');
    columns.forEach(col => {
      console.log(`${col.Field} - ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : '(NULL)'} ${col.Key === 'PRI' ? '(PRIMARY KEY)' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error creating productSaved table:', error);
  } finally {
    await connection.end();
  }
}

createProductSavedTable();
