import fs from 'fs';
import pool from './db.js';

async function initializeDatabase() {
  console.log('--- Initializing Database ---');
  try {
    // Test database connection first
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
    
    // Read the schema file
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    console.log('✅ Schema file read successfully');
    
    // Execute the entire schema at once (better for MySQL)
    await pool.query(schema);
    console.log('\n✅ Database initialized successfully! All tables have been created.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message || error);
    process.exit(1);
  }
}

initializeDatabase();