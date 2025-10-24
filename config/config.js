require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const configs = {
  development: {
    username: process.env.DATABASE_USERNAME || "postgres",
    password: process.env.DATABASE_PASS || "password",
    database: process.env.DATABASE_NAME || "school_db_dev",
    host: process.env.DATABASE_HOST || "127.0.0.1",
    dialect: "postgres",
    logging: console.log,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: { ssl: false },
  },

  production: {
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASS,
    database: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
    dialect: "postgres",
    logging: false,
    pool: { max: 20, min: 5, acquire: 60000, idle: 10000 },
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  },
};

module.exports = configs; // Keep both environments
