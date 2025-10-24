const { Sequelize } = require("sequelize");
require("dotenv").config();

const env = process.env.NODE_ENV || "development";
const configs = require("./config.js")[env];

let sequelize;

if (env === "production" && process.env.DATABASE_URL) {
  // Production (Render/Neon)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    protocol: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: configs.pool,
  });
} else {
  //  Local development
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

// Test DB connection
sequelize
  .authenticate()
  .then(() =>
    console.log(`Database connection successful [${env.toUpperCase()}]`)
  )
  .catch((err) => console.error("Database connection error:", err.message));

module.exports = sequelize;
