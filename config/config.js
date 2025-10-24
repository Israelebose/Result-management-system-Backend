require('dotenv').config();

const configs = {
  development: {
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASS,
    database: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
    dialect: 'postgres', // Explicitly specify dialect
    logging: true,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: { ssl: false }
  },
  production: {
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASS,
    database: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
    dialect: 'postgres', // Explicitly specify dialect
    logging: false,
    pool: { max: 15, min: 5, acquire: 30000, idle: 10000 },
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  }
};

module.exports = configs; // Export the configuration object, not a Sequelize instance