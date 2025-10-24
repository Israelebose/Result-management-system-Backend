const { Sequelize } = require('sequelize');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const configs = require('./config.js')[env];


console.log(configs);
// Validate configuration
if (!configs || !configs.database || !configs.username || !configs.dialect) {
  throw new Error('Invalid database configuration: Missing required fields');
}



// Use DATABASE_URL in production (common for cloud DBs)
let sequelize;
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: env === 'development' ? console.log : false,
    dialectOptions: {
      ssl: env === 'production'
        ? { require: true, rejectUnauthorized: false }
        : false,
    },
    pool: configs.pool,
  });
} else {
  // Local development config
  sequelize = new Sequelize(
    configs.database,
    configs.username,
    configs.password,
    {
      host: configs.host,
      dialect: configs.dialect,
      logging: configs.logging,
      pool: configs.pool,
      dialectOptions: configs.dialectOptions,
    }
  );
}

// Optional: Test the connection once on startup
sequelize.authenticate()
  .then(() => console.log('Database connection successful'))
  .catch(err => console.error('Database connection error:', err));

module.exports = sequelize;
