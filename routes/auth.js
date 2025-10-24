const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, sequelize, Otp, Session, AdviserSession } = require("../models");
const authMiddleware = require("../middleware/authMiddleware");
const sendOtpEmail = require("../utils/mailer");
const { Op } = require("sequelize");
const { where } = require("sequelize");

const router = express.Router();

router.get("/me", authMiddleware, async (req, res) => {
  try {
    // req.user already contains decoded data
    const { firstName, lastName, role_id, role } = req.user;
    res.json({ firstName, lastName, role_id, role });
  } catch (err) {
    res.status(401).json({ error: "Not authenticated" });
  }
});

//Fetch full profile from database
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.role_id;

    const roleRecord = await User.findOne({ where: { unique_id: userId } });
    if (!roleRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(roleRecord);
  } catch (err) {
    res.status(401).json({ error: "Invalid token or user" });
  }
});

// get profile information
router.get("/profile/:role_id", authMiddleware, async (req, res) => {
  const { role_id } = req.params;
  try {
    const user = await User.findOne({ where: { unique_id: role_id } });

    res.status(200).json(user);
  } catch (error) {
    console.error("Cannot get Profile details:", error);
    res
      .status(500)
      .json({ error: "Cannot get Profile details", details: error.message });
  }
});

router.post("/logout", async (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ message: "Logged Out Succcessfully" });
  } catch (error) {
    console.log(`error ${error}`);
    res.status(401).json({ error: "please try again" });
  }
});
// the Registration route
// This route handles Registration for all roles: admin, student, lecturer, and course_adviser
// It checks for valid inputs, verifies credentials, hash passwords etc
router.post("/register", async (req, res) => {
  const {
    matnumber,
    email,
    password,
    role,
    session,
    level,
    firstName,
    lastName,
    currentSession,
    gender,
    entryMode,
  } = req.body;
  const t = await sequelize.transaction();

  try {
    //  checking for valid values
    if (!["student", "lecturer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (role === "student") {
      if (!matnumber || !session || !currentSession || !level || !password) {
        return res.status(400).json({ error: "Fill all with your details" });
      }
    }
    if (!email || !password || !firstName || !lastName) {
      return res
        .status(400)
        .json({ error: "Please Fill all with your details" });
    }

    // Check for existing email and Matnumber for student ID and staff
    if (
      role === "student" &&
      (await User.findOne({ where: { matNumber: matnumber }, transaction: t }))
    ) {
      await t.rollback();
      return res
        .status(400)
        .json({ error: "Matriculation number already exists" });
    }
    if (await User.findOne({ where: { email }, transaction: t })) {
      await t.rollback();
      return res.status(400).json({ error: `Email already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate Unique ID
    const generateId = () => {
      const geneId = Math.floor(Math.random() * 5_000_000) + 1; // range: 1 to 5,000,000
      return geneId.toString().padStart(6, "0");
    };
    const roleStringId = generateId();

    // Create role-specific record
    const roleRecord = await User.create(
      {
        role,
        unique_id: roleStringId,
        matNumber: role === "student" ? matnumber : "N/A",
        firstName,
        lastName,
        email,
        password: hashedPassword,
        level: role === "student" ? level : 0,
        session: role === "student" ? session : "N/A",
        currentSession: role === "student" ? currentSession : "N/A",
        courseAdviserLevel: 0,
        is_approved: false,
        gender: role === "student" ? gender : "N/A",
        entryMode: role === "student" ? entryMode : "N/A",
        is_deleted: false,
        deleted_at: null,
        is_staff: role === "lecturer" ? true : false,
        // is_graduated: false,
      },
      { transaction: t }
    );

    // Create User record using the role model's primary key (id)
    const message =
      role === "student"
        ? "Student registered successfully"
        : "Staff registered successfully, pending admin approval";
    await t.commit();
    res.status(200).json({ message, email: roleRecord.email });
  } catch (error) {
    await t.rollback();
    console.error("Registration error:", error);
    res
      .status(500)
      .json({ error: "Registration failed", details: error.message });
  }
});

// the login route
// This route handles login for all roles: admin, student, lecturer, and course_adviser
// It checks for valid inputs, verifies credentials, and generates a JWT token for authenticated users.
// For students, it requires matriculation number and password.
// For other roles, it requires email and password.
router.post("/login", async (req, res) => {
  const { matnumber, email, password, role } = req.body;

  try {
    const details = matnumber ? { matNumber: matnumber } : { email };
    const roleRecord = await User.findOne({ where: details });
    if (!roleRecord) {
      return res.status(401).json({
        error: matnumber
          ? "Invalid matriculation number"
          : "Email not registered",
      });
    }
    // Validate inputs
    if (
      !["admin", "lecturer", "course_adviser", "student"].includes(
        roleRecord.role
      )
    ) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (roleRecord.matNumber !== "N/A" && email) {
      return res
        .status(401)
        .json({ error: "Please Use Your Matriculation Number to login" });
    }
    if (roleRecord.role === "student" && (!matnumber || !password)) {
      return res.status(400).json({
        error: "Matriculation number and password required for students",
      });
    }
    if (roleRecord.role !== "student" && (!email || !password)) {
      return res
        .status(400)
        .json({ error: "Email and password required for staff" });
    }

    const isMatch = await bcrypt.compare(password, roleRecord.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    if (roleRecord.role !== "student") {
      if (!roleRecord.is_approved) {
        return res.status(401).json({ error: "Account pending for approval" });
      }
    }

    const token = jwt.sign(
      {
        id: roleRecord.id,
        role: roleRecord.role,
        role_id: roleRecord.unique_id,
        currentSession: roleRecord.currentSession || null,
        level: roleRecord.level || null,
        is_staff: roleRecord.is_staff || false,
        // matnumber: roleRecord.matNumber,
        // courseAdviserLevel: roleRecord.courseAdviserLevel,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 3600000,
    });

    res.json({ message: "Login successful", role: roleRecord.role });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed", details: error.message });
  }
});

// the GET all users route
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const decoded = req.user;
    if (
      decoded.role !== "admin" &&
      decoded.role !== "super_admin" &&
      decoded.role !== "course_adviser"
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (decoded.role === "course_adviser") {
      const students = await User.findAll({
        where: {
          role: "student", // ensures it's a student
        },
      });

      const formattedUsers = await Promise.all(
        students.map(async (user) => {
          let f_count = 0;
          if (user.role === "student") {
            // TODO: Implement actual f_count calculation assuming Results model exists
            // f_count = await Results.count({ where: { studentId: user.id, grade: 'F', session: user.session } });
          }
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: `${user.firstName} ${user.lastName}`,
            role_id: user.unique_id,
            level: user.level,
            courseAdviserLevel: user.courseAdviserLevel,
            session: user.session,
            currentSession: user.currentSession,
            matNumber: user.matNumber,
            password: user.password,
            gender: user.gender,
            // course_adviser_id: user.Student?.course_adviser_id || null,
            is_approved: user.is_approved,
            // is_graduated: user.is_graduated || false,
            // f_count,
          };
        })
      );

      return res.status(200).json(formattedUsers);
    } else {
      const users = await User.findAll();

      const formattedUsers = await Promise.all(
        users.map(async (user) => {
          let f_count = 0;
          if (user.role === "student") {
            // TODO: Implement actual f_count calculation assuming Results model exists
            // f_count = await Results.count({ where: { studentId: user.id, grade: 'F', session: user.session } });
          }
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: `${user.firstName} ${user.lastName}`,
            role_id: user.unique_id,
            level: user.level,
            courseAdviserLevel: user.courseAdviserLevel,
            session: user.session,
            currentSession: user.currentSession,
            matNumber: user.matNumber,
            password: user.password,
            gender: user.gender,
            // course_adviser_id: user.Student?.course_adviser_id || null,
            is_approved: user.is_approved,
            // is_graduated: user.is_graduated || false,
            // f_count,
          };
        })
      );

      return res.status(200).json(formattedUsers);
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// the approval route
// This route handles the approval of admin, lecturer, and course_adviser accounts by the super admin.
// It checks for valid inputs, verifies the existence of the role record, and updates the approval status.
// It requires the role and ID of the record to be approved.
router.patch("/approve/:role/:id", authMiddleware, async (req, res) => {
  const { role, id } = req.params;
  try {
    const validRoles = ["student", "admin", "lecturer", "course_adviser"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const roleRecord = await User.findOne({ where: { unique_id: id } });
    if (!roleRecord) {
      return res.status(404).json({ error: `${role} not found` });
    }

    if (roleRecord.is_approved) {
      return res.status(400).json({ error: `${role} already approved` });
    }

    await User.update({ is_approved: true }, { where: { unique_id: id } });
    res.status(200).json({ message: `${role} approved successfully` });
  } catch (error) {
    console.error("Approval error:", error);
    res.status(500).json({ error: "Approval failed", details: error.message });
  }
});

// to delete users by admin and super-admin
router.delete("/delete/:role/:id", authMiddleware, async (req, res) => {
  const { id, role } = req.params;

  try {
    const decoded = req.user;

    // 1. FIX THE AUTHORIZATION LOGIC
    // The correct way to check if the role is NOT admin AND NOT super_admin
    if (decoded.role !== "admin") {
      return res.status(403).json({
        error: "Access Denied: Only Admins are allowed to delete accounts.",
      });
    }

    // 2. INPUT VALIDATION (Keep as-is)
    const validRoles = ["admin", "lecturer", "course_adviser", "student"];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ error: "Invalid role specified for deletion." });
    }

    // Check if the user exists
    const roleRecord = await User.findOne({ where: { unique_id: id } });
    if (!roleRecord) {
      return res.status(404).json({ error: `User with ID ${id} not found.` });
    }

    // Calculate the date one month from now for permanent cleanup
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    // Perform the soft delete update
    await User.update(
      {
        is_deleted: true,
        deleted_at: oneMonthFromNow, // Set the future date for permanent deletion
      },
      { where: { unique_id: id } }
    );

    res.status(200).json({
      message: `Account for role '${role}' (ID: ${id}) has been marked for soft deletion. 
      It will be permanently removed after 30 days on ${oneMonthFromNow.toLocaleDateString()}.`,
    });
  } catch (error) {
    console.error("Deletion process error:", error);
    res.status(500).json({
      error: "Account deletion failed due to a server error.",
      details: error.message,
    });
  }
});

// to update roles by admin and super-adamin
router.patch("/update-role/:id/:roleId", authMiddleware, async (req, res) => {
  const { id, roleId } = req.params;
  const { newRole, courseAdviserLevel } = req.body;

  try {
    const decoded = req.user;
    // Restrict to admin
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Only admins can update roles" });
    }

    // Validate role
    const validRoles = ["admin", "lecturer", "course_adviser"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    //Find target user
    const user = await User.findOne({ where: { id, unique_id: roleId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // If assigning as course adviser
    if (newRole === "course_adviser") {
      // Get current session
      const currentSession = await Session.findOne({
        where: { isCurrent: true },
      });
      if (!currentSession)
        return res.status(400).json({ error: "No active session found" });

      // Update user role and adviser info
      await user.update({
        role: "course_adviser",
        isActiveAdviser: true,
      });
    } else {
      //For lecturer/admin roles
      await user.update({
        role: newRole,
        isActiveAdviser: false,
        courseAdviserLevel: 0,
      });
    }

    res.json({ message: "Role updated successfully" });
  } catch (error) {
    console.error("Role update error:", error);
    res
      .status(500)
      .json({ error: "Failed to update role", details: error.message });
  }
});

// to change course-adviser level
router.patch(
  "/update-ca-level/:unique_id",
  authMiddleware,
  async (req, res) => {
    const { unique_id } = req.params;
    const { courseAdviserLevel } = req.body;

    try {
      const decoded = req.user;

      if (decoded.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Only admins can change adviser levels" });
      }

      if (!courseAdviserLevel) {
        return res
          .status(400)
          .json({ error: "courseAdviserLevel is required" });
      }

      const adviser = await User.findOne({ where: { unique_id } });
      if (!adviser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (adviser.role !== "course_adviser") {
        return res
          .status(400)
          .json({ error: "Only course advisers can have a level assigned" });
      }

      const currentSession = await Session.findOne({
        where: { isCurrent: true },
      });
      if (!currentSession) {
        return res.status(400).json({ error: "No active session found" });
      }

      // Deactivate any existing active adviser for this level
      await User.update(
        { isActiveAdviser: false },
        {
          where: {
            role: "course_adviser",
            courseAdviserLevel,
            id: { [Op.ne]: adviser.id },
          },
        }
      );

      //  Check if adviser-session relationship exists
      const existing = await AdviserSession.findOne({
        where: { adviserId: adviser.id, sessionId: currentSession.id },
      });

      if (existing) {
        // Update existing record
        await existing.update({ levelHandled: courseAdviserLevel });
      } else {
        // Create new relationship record
        await AdviserSession.create({
          adviserId: adviser.id,
          sessionId: currentSession.id,
          levelHandled: courseAdviserLevel,
          published: false,
        });
      }

      // Update adviser record
      await adviser.update({
        courseAdviserLevel,
        isActiveAdviser: true,
      });

      return res
        .status(200)
        .json({ message: "Course adviser level updated successfully" });
    } catch (error) {
      console.error("Error updating course adviser level:", error);
      return res.status(500).json({
        error: "Failed to update adviser level",
        details: error.message,
      });
    }
  }
);

// to probate student
router.patch(
  "/probate-student/:unique_id",
  authMiddleware,
  async (req, res) => {
    const { unique_id } = req.params;
    const { level } = req.body;
    try {
      const roleRecord = await User.findOne({ where: { unique_id } });
      if (!roleRecord) return res.status(401).json({ error: "User not found" });
      if (roleRecord.role !== "student" && roleRecord.unique_id !== unique_id)
        return res.status(401).json({ error: "Check the selected student" });

      await User.update(
        { level, is_approved: false },
        { where: { unique_id, id: roleRecord.id, email: roleRecord.email } }
      );
      res.status(200).json({ message: "updated Successfully" });
    } catch (error) {
      console.log({ " error ": error });
    }
  }
);

//to update user imformation by user
router.patch("/profile/update", authMiddleware, async (req, res) => {
  const { firstName, lastName, password, matnumber, uniqueId } = req.body;
  let { email } = req.body;
  const decoded = req.user;
  try {
    if (!email || !firstName || !lastName) {
      return res
        .status(400)
        .json({ error: "Please Fill all with your details" });
    }

    const roleRecord = await User.findOne({ where: { unique_id: uniqueId } });
    if (!roleRecord) return res.status(401).json({ error: "User not Found" });

    const emailcheck = await User.findOne({ where: { email } });
    if (emailcheck) {
      if (email === emailcheck.email && email !== roleRecord.email)
        return res
          .status(401)
          .json({ error: "email already exist use another email" });
    }

    let hashedPassword;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    await roleRecord.update(
      {
        firstName,
        lastName,
        email,
        matNumber: matnumber,
        password: hashedPassword,
      },
      { where: { unique_id: uniqueId, email } }
    );

    res.status(200).json({ message: "Profile updated success" });
  } catch (error) {
    console.error("profile Update error:", error);
    res
      .status(500)
      .json({ error: "Profile Update Unsuccessful", details: error.message });
  }
});

// delete profile information
router.delete("/delete/:role_id", authMiddleware, async (req, res) => {
  const { role_id } = req.params;
  try {
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const [updatedRows] = await User.update(
      {
        is_deleted: true,
        deleted_at: oneMonthFromNow,
      },
      { where: { unique_id: role_id } }
    );

    if (updatedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json({
      message: `Account marked for deletion. It will be permanently removed after 30 days on ${oneMonthFromNow.toLocaleDateString()}.`,
    });
  } catch (error) {
    console.error("Error marking account for deletion:", error);
    res.status(500).json({
      error: "Failed to process deletion request.",
      details: error.message,
    });
  }
});
// undo delete profile information
router.delete("/undo-delete/:role_id", authMiddleware, async (req, res) => {
  const { role_id } = req.params;
  try {
    await User.update(
      {
        is_deleted: false,
        deleted_at: null,
        // is_approved: false,
      },
      { where: { unique_id: role_id } }
    );
    res.status(200).json({ message: "Account is restored Successfully" });
  } catch (error) {
    console.error("Cannot get Profile details:", error);
    res
      .status(500)
      .json({ error: "Cannot get Profile details", details: error.message });
  }
});

// delete Many (bulk delete)
// DELETE MULTIPLE USERS BY IDS
router.delete("/delete-many", authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body; // expect an array of user IDs

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "Please provide a valid array of user IDs to delete.",
      });
    }

    // Filter out ID 1 (Default Admin)
    const filteredIds = ids.filter((id) => id !== 1);

    if (filteredIds.length === 0 && ids.includes(1)) {
      return res.status(400).json({
        error: "You cannot delete the Default Admin (ID: 1).",
      });
    } else if (filteredIds.length < ids.length) {
      // Inform the user that ID 1 was excluded
      console.warn("Attempted to delete ID 1, which was skipped.");
    }

    // Calculate the date one month from now for permanent cleanup
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    // Perform the soft delete update on all filtered IDs
    const [markedCount] = await User.update(
      {
        is_deleted: true,
        deleted_at: oneMonthFromNow, // Set the future date for permanent deletion
      },
      { where: { id: filteredIds } } // Sequelize handles the bulk update WHERE ID IN (...)
    );

    return res.status(200).json({
      message: `${markedCount} user accounts have been marked for soft deletion. They will be permanently removed on or after ${oneMonthFromNow.toLocaleDateString()}.`,
    });
  } catch (error) {
    console.error("Error marking users for soft deletion:", error);
    return res.status(500).json({
      error: "Error processing bulk deletion request.",
      details: error.message,
    });
  }
});

// ///////////////////////////////////////////////////////////
// /////////////////////////////////////////////////////////////
// --------------------
// Forgot Password Route
// --------------------
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "Email not registered" });

    // Generate OTP and expiry (5 minutes)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Upsert OTP (update if exists, otherwise create)
    await Otp.upsert(
      {
        unique_id: user.unique_id,
        email,
        otp: hashedOtp,
        used: false,
        expiresAt,
        type: "password_reset",
      },
      { conflictFields: ["unique_id"] }
    );

    // Send OTP email
    await sendOtpEmail(email, otp);

    console.log(`📨 OTP for ${email}: ${otp}`);
    return res.json({ message: "OTP sent to your email", role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// --------------------
// Verify OTP Route
// --------------------
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: "Missing fields" });

    const otpRecord = await Otp.findOne({ where: { email, used: false } });
    if (!otpRecord)
      return res.status(410).json({ error: "OTP expired or not found" });

    if (new Date() > otpRecord.expiresAt) {
      return res.status(410).json({ error: "OTP expired" });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) return res.status(401).json({ error: "Invalid OTP" });

    // Mark OTP as used
    await otpRecord.update({ used: true, otp: null });

    res.json({ message: "OTP verified. You may now reset your password." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

router.patch("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "Email not registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword });

    console.log(`user with ${email} email updated password`);
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.log(`error: ${error}`);
    res.status(401).json({ error: "Failed to update password" });
  }
});

// ////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////
router.get("/users/stats", authMiddleware, async (req, res) => {
  // const decoded = req.user
  try {
    // if (decoded.role !== 'admin' && decoded.role !== 'super-admin') {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }
    //  total users
    let totalUsers = await User.findAll();
    totalUsers = totalUsers.length;

    //  total student
    const cal_length = async (role) => {
      const total = await User.findAll({ where: { role: role } });
      return total.length;
    };
    //  total student
    const totalStudent = await cal_length("student");

    const totalAdmin = await cal_length("admin");
    const totalLecturer = await cal_length("lecturer");
    const totalCourse_adviser = await cal_length("course_adviser");

    let pendingApprovals = await User.findAll({
      where: { is_approved: false },
    });
    pendingApprovals = pendingApprovals.length;

    let newSession = await User.findOne({ where: { unique_id: "000000" } });
    newSession = newSession.currentSession;
    res.json({
      totalUsers: totalUsers,
      roles: {
        student: totalStudent,
        admin: totalAdmin,
        lecturer: totalLecturer,
        course_adviser: totalCourse_adviser,
      },
      currentSession: newSession,
      pendingApprovals: pendingApprovals,
    });
  } catch (error) {
    console.log({ err: error });
  }
});

// course adviser stats
router.get(
  "/ca/stats/:courseAdviserLevel",
  authMiddleware,
  async (req, res) => {
    const { courseAdviserLevel } = req.params;
    const decoded = req.user;
    try {
      if (decoded.role !== "course_adviser") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      //  total users
      let totalUsers = await User.findAll({
        where: { role: "student", level: courseAdviserLevel },
      });
      totalUsers = totalUsers.length;
      // pending student
      let pendingApprovals = await User.findAll({
        where: {
          is_approved: false,
          role: "student",
          level: courseAdviserLevel,
        },
      });
      pendingApprovals = pendingApprovals.length;
      // current seesion
      let newSession = await User.findOne({ where: { unique_id: "000000" } });
      newSession = newSession.currentSession;
      res.json({
        totalUsers: totalUsers,
        pendingApprovals: pendingApprovals,
        currentSession: newSession,
      });
    } catch (error) {
      console.log({ err: error });
    }
  }
);

// // create new session and promote students
router.post("/update/new-session", authMiddleware, async (req, res) => {
  try {
    // Ensure only admin can perform this action
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { newSession } = req.body;
    if (!newSession) {
      return res.status(400).json({ error: "New session required" });
    }

    // Step 1: Deactivate all current sessions
    await Session.update({ isCurrent: false }, { where: {} });

    // Step 2: Check if a session with this name already exists
    let session = await Session.findOne({ where: { sessionName: newSession } });

    if (session) {
      // If it exists, just mark it as current
      await session.update({ sessionName: newSession, isCurrent: true });
    } else {
      // Otherwise, create a new one
      session = await Session.create({
        sessionName: newSession,
        isCurrent: true,
      });
    }

    // Step 3: Update all users' currentSession
    await User.update({ currentSession: newSession }, { where: {} });

    res.status(200).json({
      message: "Session updated successfully",
      session,
    });
  } catch (error) {
    console.error("Error Updating Session:", error);
    res.status(500).json({
      error: "Failed to update session",
      details: error.message,
    });
  }
});

// create new session
router.post("/new-session", authMiddleware, async (req, res) => {
  const decoded = req.user;

  if (decoded.role !== "admin" && decoded.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { newSession } = req.body;
  if (!newSession) {
    return res.status(400).json({ error: "New session required" });
  }

  try {
    const exists = await Session.findOne({
      where: { sessionName: newSession },
    });
    if (exists)
      return res.status(400).json({ error: "Session already exists" });

    // Close old sessions
    await Session.update({ isCurrent: false }, { where: {} });

    // Create the new session
    const createdSession = await Session.create({
      sessionName: newSession,
      isCurrent: true,
    });

    // --- Promote students ---
    const students = await User.findAll({ where: { role: "student" } });
    for (const student of students) {
      let newLevel = student.level + 100;
      if (student.level >= 500) newLevel = 1; // reset for new intake
      await student.update({ level: newLevel, currentSession: newSession });
    }

    // --- Update course advisers ---
    const advisers = await User.findAll({ where: { role: "course_adviser" } });

    for (const adviser of advisers) {
      let newAdviserLevel = adviser.courseAdviserLevel + 100;

      // reset advisers at 500 level back to 100
      if (adviser.courseAdviserLevel >= 500) {
        newAdviserLevel = 1;
      }

      await adviser.update({
        courseAdviserLevel: newAdviserLevel,
        currentSession: newSession,
        isActiveAdviser: true,
      });

      // track in AdviserSession
      await AdviserSession.create({
        adviserId: adviser.id,
        sessionId: createdSession.id,
        published: false,
        levelHandled: newAdviserLevel,
      });
    }

    // update all staff session
    await User.update({ currentSession: newSession }, { where: {} });

    res.status(200).json({ message: "New session opened successfully" });
  } catch (error) {
    console.error("New session error:", error);
    res.status(500).json({
      error: "Failed to open new session",
      details: error.message,
    });
  }
});

router.post("/waive-and-graduate/:roleId", authMiddleware, async (req, res) => {
  const { roleId } = req.params;
  const decoded = req.user;

  if (decoded.role !== "admin" && decoded.role !== "super_admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const student = await User.findOne({
      where: { unique_id: roleId, role: "student" },
    });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (student.level !== 500) {
      return res
        .status(400)
        .json({ error: "Only 500 level students can be waived and graduated" });
    }

    // TODO: Calculate actual fCount assuming Results model exists
    // const fCount = await Results.count({ where: { studentId: student.id, grade: 'F', session: student.session } });
    const fCount = 0; // Dummy value; replace with actual count

    if (fCount > 2) {
      return res
        .status(400)
        .json({ error: "Student has more than 2 F's and cannot be waived" });
    }

    // TODO: Waive courses - update Results to 'Waived' or delete
    // await Results.update({ grade: 'Waived' }, { where: { studentId: student.id, grade: 'F', session: student.session } });

    await student.update({ is_graduated: true, level: "Graduated" });

    res
      .status(200)
      .json({ message: "Student waived and graduated successfully" });
  } catch (error) {
    console.error("Waive and graduate error:", error);
    res.status(500).json({
      error: "Failed to waive and graduate student",
      details: error.message,
    });
  }
});

module.exports = router;
