const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware.js");
const sequelize = require("../config/db.js");
const {
  User,
  Courses,
  CourseRegistration,
  RegistrationCourses,
  Result,
} = require("../models"); // Import models

/** STUDENT registers courses */
router.post("/register-courses", authMiddleware, async (req, res) => {
  try {
    const {
      firstSemesterCourses,
      secondSemesterCourses,
      session,
      totalCredit,
    } = req.body;
    const studentId = req.user.role_id;
    const level = req.user.level;

    if (!session) return res.status(400).json({ error: "Session is required" });

    if (
      (!firstSemesterCourses || firstSemesterCourses.length === 0) &&
      (!secondSemesterCourses || secondSemesterCourses.length === 0)
    )
      return res.status(400).json({ error: "No courses selected" });

    const sessionCheck = await CourseRegistration.findOne({
      where: { studentUniqueId: studentId, session },
    });
    if (sessionCheck) {
      if (sessionCheck.session === session) {
        // Remove previous registration for same session
        await CourseRegistration.destroy({
          where: { studentUniqueId: studentId, session },
        });
      }
    }

    // Create new registration record
    const newReg = await CourseRegistration.create({
      studentUniqueId: studentId,
      session,
      level,
      totalCredit,
      status: "registered",
    });

    // Combine all courses into one array (add semester info)
    const courseMappings = [
      ...firstSemesterCourses.map((id) => ({
        registrationId: newReg.id,
        courseId: id,
        semester: "First",
      })),
      ...secondSemesterCourses.map((id) => ({
        registrationId: newReg.id,
        courseId: id,
        semester: "Second",
      })),
    ];

    // Bulk insert
    await RegistrationCourses.bulkCreate(courseMappings);

    return res.status(201).json({
      message: "Courses registered successfully",
      registrationId: newReg.id,
      totalRegistered: courseMappings.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Course registration failed",
      details: error.message,
    });
  }
});

/** -----------------------------
 * CREATE COURSE
 * ----------------------------- */
router.post("/create-course", authMiddleware, async (req, res) => {
  try {
    const { courseCode, courseTitle, credits, level, semester, lecturerIds } =
      req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const existing = await Courses.findOne({ where: { courseCode } });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Course with this code already exists" });
    }

    const course = await Courses.create({
      courseCode,
      courseTitle,
      credits,
      level,
      semester,
    });

    if (lecturerIds && lecturerIds.length > 0) {
      const lecturers = await User.findAll({
        where: { unique_id: lecturerIds },
      });
      await course.addLecturers(lecturers);
    }

    res.status(201).json({ message: "Course created successfully", course });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create course" });
  }
});

/** -----------------------------
 * RESULTS UPLOAD MANAGEMENT
 * ----------------------------- */

// Upload grades
// Upload grades
router.post("/upload-grades", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "lecturer", "course_adviser"].includes(req.user.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { courseId, session, grades } = req.body;

    // Get the course info (for courseCode + semester)
    const course = await Courses.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const { courseCode, semester } = course;

    // Loop through all grades
    for (const g of grades) {
      const total = g.CA + g.Exam;
      const gradeLetter =
        total >= 70
          ? "A"
          : total >= 60
          ? "B"
          : total >= 50
          ? "C"
          : total >= 45
          ? "D"
          : "F";

      // Fetch the student's level (current or from registration)
      const student = await User.findOne({
        where: { unique_id: g.studentUniqueId },
        attributes: ["level"],
      });

      const studentLevel = student?.level || null;

      // Check if result already exists
      const existingResult = await Result.findOne({
        where: { studentUniqueId: g.studentUniqueId, courseCode, session },
      });

      if (existingResult) {
        // Update existing result
        await Result.update(
          {
            CA: g.CA,
            Exam: g.Exam,
            Total: total,
            Grade: gradeLetter,
            session,
            level: studentLevel, 
            published: false,
          },
          {
            where: { studentUniqueId: g.studentUniqueId, courseCode, session },
          }
        );
      } else {
        // Create new result
        await Result.create({
          studentUniqueId: g.studentUniqueId,
          courseCode,
          CA: g.CA,
          Exam: g.Exam,
          Total: total,
          Grade: gradeLetter,
          session,
          level: studentLevel, 
          published: false,
        });
      }
    }

    res.status(200).json({ message: "Grades uploaded successfully" });
  } catch (err) {
    console.error("Grade upload error:", err);
    res.status(500).json({ error: "Failed to upload grades" });
  }
});


// ////////////////////////////////
//// publish result
////////////////////////////
router.post("/results/publish", authMiddleware, async (req, res) => {
  const { sessionId, levelHandled } = req.body;
  const decoded = req.user;

  if (decoded.role !== "course_adviser") {
    return res.status(403).json({ error: "Only course advisers can publish results" });
  }

  await AdviserSession.update(
    { isPublished: true },
    { where: { adviserId: decoded.role_id, sessionId, levelHandled } }
  );

  return res.json({ success: true, message: "Results published successfully" });
});




module.exports = router;
