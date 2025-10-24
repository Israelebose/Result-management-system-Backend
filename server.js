// Load environment variables from .env file
require("dotenv").config();

// Import dependencies (CommonJS style)
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const app = express();
const { Op, where } = require("sequelize");
const cron = require("node-cron");

// Database connection & models
const sequelize = require("./config/db.js"); // Your Sequelize instance
const models = require("./models"); // User model
const User = models.User;
const Courses = models.Courses



const PORT = process.env.PORT || 5000;

// =========================
// MIDDLEWARE
// =========================
const allowedOrigins = [
  process.env.FRONTEND_URL, // your live site
  "http://localhost:5173",              // local dev
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS not allowed from this origin"));
      }
    },
    credentials: true,
  })
);

// Allow preflight requests for all routes
app.options("*", cors());
app.use(cookieParser());
app.use(express.json());

// =========================
// ROUTES
// =========================
const authRoutes = require("./routes/auth.js");
const getRoutes = require('./routes/get.js');
const postRoutes = require('./routes/post.js');
const deleteRoutes =  require('./routes/delete.js')
const putRoute = require('./routes/put.js')

app.use('/delete', deleteRoutes);
app.use('/put', putRoute);
app.use("/auth", authRoutes);
app.use('/get', getRoutes);
app.use('/post', postRoutes);
// =========================
// SCHEDULED TASKS
// =========================

// cron update for unused otp
// Run every 5 minutes
// cron.schedule('*/5 * * * *', async () => {
//   try {
//     const deleted = await Otp.destroy({
//       where: {
//         expiresAt: { [Op.lt]: new Date() },
//         used: false
//       }
//     });
//     if (deleted) return console.log(`✅ Cleaned ${deleted} expired OTP(s)`);
//     else {
//       console.log('no expired OTP(s)')
//     }
//   } catch (err) {
//     console.error('❌ Error cleaning OTPs:', err);
//   }
// });
// // =========================
// DATABASE SYNC & SERVER START
// =========================
(async () => {
  try {
    // Authenticate database connection
    await sequelize
      .authenticate()
      .then(() =>
        console.log("✅ Database connection established successfully")
      )
      .catch((err) => console.error("Database connection error:", err));

    // Sync models with the database
    await sequelize.sync({ force: false });
    // force: ifalse → Do not drop tables (safe for production)
    // force: true  → Drop & recreate tables (only for dev)
    console.log("✅ Models synced with database");

    //Create default admin account if not exists
    const [admin, created] = await User.findOrCreate({
      where: { unique_id: "000000" },
      defaults: {
        firstName: "Super",
        lastName: "Admin",
        email: "massiveebose@gmail.com",
        password: await bcrypt.hash("123123", 10),
        role: "admin",
        unique_id: "000000",
        matNumber: "N/A",
        is_staff: true,
        is_approved: true,
        is_deleted: false,
        deleted_at: null,
        entryMode: "N/A",
        currentSession: "N/A",
        session: "N/A",
        gender:"N/A",
        courseAdviserLevel: 0,
        level: 0,
      },
    });

    if (created) {
      console.log(
        "👑 Default admin created "
      );
    } else {
      console.log("👑 Default admin already exists");
    }

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
  }
})();
