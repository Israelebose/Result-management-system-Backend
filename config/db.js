
const { Sequelize } = require('sequelize');
require('dotenv').config();
const env = process.env.NODE_ENV || 'development';

// Load configsuration from configs/configs.js
const configs = require('./config.js')[env];

// Validate configsuration
if (!configs.database || !configs.username || !configs.dialect) {
  throw new Error('Invalid database configsuration: Missing required fields');
}

// Create Sequelize instance
const sequelize = new Sequelize(
  configs.database,
  configs.username,
  configs.password,
  {
    host: configs.host,
    dialect: configs.dialect,
    logging: configs.logging,
    pool: configs.pool,
    dialectOptions: configs.dialectOptions
  }
);

// Optional: Test connection
sequelize.authenticate()
  .then(() => console.log('Database connection successful'))
  .catch(err => console.error('Database connection error:', err));

module.exports = sequelize;