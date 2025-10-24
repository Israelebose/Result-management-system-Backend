const express = require("express");
const authMiddleware = require("../middleware/authMiddleware.js");
const {
  User,
  Courses,
  CourseRegistration,
  Result,
  RegistrationCourses,
  AdviserSession,
  Session,
} = require("../models"); // Import models
const router = express.Router();
const { Op } = require("sequelize");

// Get all sessions
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await Session.findAll({ order: [["createdAt", "DESC"]] });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

//get lecturer
router.get("/lecturers", async (req, res) => {
  const users = await User.findAll({ where: { is_staff: true } });
  if (users.length < 1)
    return res.status(404).json({ error: "No lecturer found" });
  return res.status(200).json(users);
});

// get all courses (with lecturers)
router.get("/courses", authMiddleware, async (req, res) => {
  try {
    const courses = await Courses.findAll({
      include: [
        {
          model: User,
          as: "lecturers",
          attributes: ["unique_id", "firstName", "lastName", "email"],
          through: { attributes: [] },
        },
      ],
      order: [["level", "ASC"]],
    });

    if (!courses.length)
      return res.status(404).json({ error: "No course found" });

    return res.status(200).json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// get all courses (without lecturers)
router.get("/courses/all", authMiddleware, async (req, res) => {
  try {
    const courses = await Courses.findAll();

    if (!courses.length)
      return res.status(404).json({ error: "No course found" });

    return res.status(200).json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// get course by level
router.get("/courses/level/:level", async (req, res) => {
  try {
    
    const { level } = req.params;
    const courses = await Courses.findAll({ where: { level } });   
    if (courses.length === 0)
      return res.status(404).json({ error: "No course found for this level" });
    return res.status(200).json(courses);   
  } catch (error) {     
    console.error(error);   
    res.status(500).json({ error: "Failed to fetch courses by level" });  
  }
});

// regsitration status
router.get("/registration/status", authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.role_id;
    const session = req.user.currentSession;
    const registration = await CourseRegistration.findOne({
      where: { studentUniqueId: studentId, session },
    });

    if (!registration) {
      return res.status(200).json({ message: "Not registered" });
    } else {
      return res.status(200).json({ message: registration.status });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch registration status" });
  }
});

/** -----------------------------
 * GET COURSES ASSIGNED TO STAFF
 * ----------------------------- */
router.get("/my-courses", authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_staff) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = await User.findOne({
      where: { unique_id: req.user.role_id },
      include: [
        {
          model: Courses,
          as: "courses",
          attributes: [
            "courseCode",
            "courseTitle",
            "credits",
            "level",
            "semester",
          ],
          through: { attributes: [] },
        },
      ],
    });

    res.status(200).json({ courses: user.courses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failedd to fetch assigned courses" });
  }
});

/////////////////////////////////////////////
///////////////////////////////////////////
// for GRADES MANAGEMENT
//////////////////////////////////////////
//////////////////////////////////////////
//  Get lecturer’s assigned courses
router.get("/lecturer-courses", authMiddleware, async (req, res) => {
  try {
    const lecturerId = req.user.role_id;
    const lecturer = await User.findOne({
      where: { unique_id: lecturerId },
      include: {
        model: Courses,
        as: "courses", // ensure your User–Courses association uses this alias
        through: { attributes: [] },
      },
    });

    if (!lecturer) return res.status(404).json({ error: "Lecturer not found" });

    res.json({ courses: lecturer.courses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lecturer courses" });
  }
});

//  Get students registered for a course
// Get students registered for a course (with results if available)
// Get students registered for a course (with results if available)
router.get("/course-registrations/:courseId", authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Get courseCode + level from courseId
    const course = await Courses.findByPk(courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });

    const { courseCode, level: courseLevel } = course;

    // Find all registration-course links for this course
    const courseLinks = await RegistrationCourses.findAll({
      where: { courseId },
      include: [
        {
          model: CourseRegistration,
          as: "registration",
          include: {
            model: User,
            as: "student",
            attributes: ["unique_id", "firstName", "lastName", "matNumber"],
          },
        },
      ],
    });

    if (courseLinks.length === 0) {
      return res.json({ students: [], courseCode, courseLevel });
    }

    // Collect all student IDs
    const studentIds = courseLinks
      .map((link) => link.registration?.studentUniqueId)
      .filter(Boolean);

    //  Fetch existing results using courseCode
    const results = await Result.findAll({
      where: {
        courseCode,
        studentUniqueId: { [Op.in]: studentIds },
      },
    });

    //  Map results by studentUniqueId for quick lookup
    const resultMap = {};
    results.forEach((r) => {
      resultMap[r.studentUniqueId] = {
        CA: r.CA,
        Exam: r.Exam,
        Total: r.Total,
        Grade: r.Grade,
        session: r.session,
        level: r.level, // Added this (from Result)
      };
    });

    // Combine registration info + results + level
    const students = courseLinks.map((link) => {
      const reg = link.registration;
      const student = reg?.student;
      const existing = resultMap[reg?.studentUniqueId] || {};

      return {
        studentUniqueId: reg?.studentUniqueId,
        matricNumber: student?.matNumber,
        name: `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
        CA: existing.CA ?? 0,
        Exam: existing.Exam ?? 0,
        Total: existing.Total ?? 0,
        Grade: existing.Grade ?? "-",
        session: existing.session || reg?.session || null,
        level: existing.level ?? reg?.level ?? courseLevel , 
      };
    });

    res.json({ students, courseCode, courseLevel });
  } catch (err) {
    console.error("Course registration fetch error:", err);
    res.status(500).json({ error: "Failed to fetch course students" });
  }
});


// GET ALL REGISTERED COURSES FOR A STUDENT
// GET /api/student-registrations/:studentId
// Query param: session, optional
// Get student registrations for a session
router.get("/student-registrations/:studentId", async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const { session } = req.query; // e.g. ?session=2024/2025

    const whereClause = { studentUniqueId: studentId };
    if (session) whereClause.session = session; // filter by session if provided

    const regs = await CourseRegistration.findAll({
      where: whereClause,
      include: [
        {
          model: Courses,
          as: "courses",
          through: { attributes: [] },
          attributes: ["courseCode", "courseTitle", "credits", "semester"],
        },
      ],
    });

    const registrations = regs.map((reg) => ({
      session: reg.session,
      level: reg.level,
      totalCredit: reg.totalCredit,
      courses: reg.courses.map((c) => ({
        courseCode: c.courseCode,
        courseTitle: c.courseTitle,
        credits: c.credits,
        semester: c.semester,
      })),
    }));

    res.json({ registrations });
  } catch (err) {
    console.error("Error fetching registrations:", err);
    res.status(500).json({ error: "Failed to fetch registrations" });
  }
});


// ///////////////////////////////////////
////////////////////////////////////////////
// STUDENT GET GRADES FOR VIEW RESULT
////////////////////////////////////////

router.get("/results/student", authMiddleware, async (req, res) => {
  const { session } = req.query;

  try {
    const decoded = req.user;

    // Ensure only students view their own results
    if (decoded.role === "student" && !decoded.role_id) {
      return res.status(403).json({ error: "You can only view your own results" });
    }

    //  Query filter
    const filter = { studentUniqueId: decoded.role_id };
    if (session) filter.session = session;

    // Fetch results with correct alias
    const results = await Result.findAll({
      where: filter,
      include: [
        {
          model: Courses,
          as: "course", // must match the alias in Result model
          attributes: ["courseCode", "courseTitle", "credits", "semester"],
        },
      ],
      order: [
        ["session", "ASC"],
        [{ model: Courses, as: "course" }, "semester", "ASC"], // proper nested order
        [{ model: Courses, as: "course" }, "courseCode", "ASC"],
      ],
    });

    if (!results || results.length === 0) {
      return res.status(404).json({ error: "No results found" });
    }

    // Group by session → semester
    const grouped = results.reduce((acc, r) => {
      const sess = r.session;
      const sem = r.course.semester?.toString().toLowerCase() === "2" ? "second" : "first";

      if (!acc[sess]) acc[sess] = {};
      if (!acc[sess][sem]) acc[sess][sem] = [];

      acc[sess][sem].push({
        courseCode: r.course.courseCode,
        courseTitle: r.course.courseTitle,
        unit: r.course.credits,
        level: r.level,
        semester: r.course.semester,
        CA: r.CA,
        Exam: r.Exam,
        Total: r.Total,
        Grade: r.Grade,
        point: getGradePoint(r.Grade),
      });

      return acc;
    }, {});

    return res.status(200).json({
      studentId: decoded.role_id,
      results: grouped,
    });
  } catch (error) {
    console.error("Student result fetch error:", error);
    return res.status(500).json({
      error: "Failed to fetch results",
      details: error.message,
    });
  }
});

// Helper: Grade → Point
function getGradePoint(grade) {
  const points = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
  return points[grade?.toUpperCase()] ?? 0;
}


/**
 * Get all sessions this course adviser handles
 */
router.get("/adviser/sessions", authMiddleware, async (req, res) => {
  try {
    const decoded = req.user;

    // Ensure user is a course adviser
    if (decoded.role !== "course_adviser") {
      return res.status(403).json({ error: "Access denied. Advisers only." });
    }

    // Fetch sessions handled by this adviser
    const sessions = await AdviserSession.findAll({
      where: { adviserId: decoded.id },
      attributes: ["sessionId", "levelHandled"],
      include: [
        {
          model: Session,
          as: "session",
          attributes: ["sessionName"],
        },
      ],
    });

    if (!sessions.length)
      return res.json({ message: "No assigned sessions yet", sessions: [] });

    // Format: ["2024/2025", "2023/2024"]
    const formatted = sessions.map((s) => s.session.sessionName);

    res.status(200).json({
      sessions: formatted,
      handledLevels: sessions.map((s) => s.levelHandled),
    });
  } catch (error) {
    console.error("Adviser sessions fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch adviser sessions",
      details: error.message,
    });
  }
});


/**
 * Get results for all students under this adviser’s level & session
//  */
// GET /get/adviser/results?session=2024/2025
// router.get("/adviser/results", authMiddleware, async (req, res) => {
//   const { session } = req.query;

//   try {
//     const decoded = req.user;
//     if (decoded.role !== "course_adviser") {
//       return res.status(403).json({ error: "Access denied. Advisers only." });
//     }

//     if (!session) {
//       return res.status(200).json({ message: "session query parameter required" });
//     }

//     // Find the adviser-session row for this adviser and session name
//     const adviserSessionRow = await AdviserSession.findOne({
//       where: { adviserId: decoded.id },
//       include: [{ model: Session, as: "session", where: { sessionName: session }, attributes: ["id", "sessionName"] }],
//     });

//     if (!adviserSessionRow) {
//       return res.status(404).json({ error: "No assigned session/level found for this adviser and session" });
//     }

//     const levelHandled = adviserSessionRow.levelHandled;

//     // 1) Get all Courses belonging to that level (split into first/second)
//     const levelCourses = await Courses.findAll({
//       where: { level: levelHandled },
//       attributes: ["id", "courseCode", "courseTitle", "credits", "semester", "level"],
//       order: [["courseCode", "ASC"]],
//     });

//     const coursesFirst = levelCourses.filter(c => c.semester === 1).map(c => ({
//       courseId: c.id,
//       courseCode: c.courseCode,
//       courseTitle: c.courseTitle,
//       credits: c.credits,
//     }));
//     const coursesSecond = levelCourses.filter(c => c.semester === 2).map(c => ({
//       courseId: c.id,
//       courseCode: c.courseCode,
//       courseTitle: c.courseTitle,
//       credits: c.credits,
//     }));

//     // 2) Find all course registrations for this session and levelHandled (the students that belong to this level this session)
//     const registrations = await CourseRegistration.findAll({
//       where: { session, level: levelHandled },
//       include: [
//         { model: User, as: "student", attributes: ["unique_id", "matNumber", "firstName", "lastName"] },
//         {
//           model: RegistrationCourses,
//           as: "registration",
//           include: [
//             { model: Courses, as: "course", attributes: ["courseCode", "courseTitle", "level", "credits", "semester"] }
//           ],
//         },
//       ],
//     });

//     // If no registrations, still return empty students list (but include courses)
//     if (!registrations || registrations.length === 0) {
//       return res.status(200).json({
//         session,
//         levelHandled,
//         courses: { first: coursesFirst, second: coursesSecond },
//         students: [],
//       });
//     }

//     // 3) Collect student unique ids that we will need to fetch their results
//     const studentIds = registrations.map(r => r.studentUniqueId);

//     // 4) Fetch all Results for these students in this session (include course to get its level)
//     const allResults = await Result.findAll({
//       where: { session, studentUniqueId: { [Op.in]: studentIds } },
//       include: [{ model: Courses, as: "course", attributes: ["courseCode", "level", "semester", "courseTitle", "credits"] }],
//     });

//     // Build results map: studentUniqueId -> array of results
//     const resultsByStudent = {};
//     allResults.forEach(r => {
//       if (!resultsByStudent[r.studentUniqueId]) resultsByStudent[r.studentUniqueId] = [];
//       resultsByStudent[r.studentUniqueId].push({
//         courseCode: r.courseCode,
//         Total: r.Total,
//         Grade: r.Grade,
//         CA: r.CA,
//         Exam: r.Exam,
//         level: r.course?.level ?? null,
//         semester: r.course?.semester ?? null,
//       });
//     });

//     // 5) Build students payload expected by frontend
//     const students = registrations.map((reg, idx) => {
//       const student = reg.student;
//       const studentResults = resultsByStudent[reg.studentUniqueId] || [];

//       // Build quick lookup by courseCode for student's results
//       const resultLookup = {};
//       studentResults.forEach(r => { resultLookup[r.courseCode] = r; });

//       // For CA-level courses (first & second), map each course to the student's grade if exists (or default placeholders)
//       const firstCoursesWithGrades = coursesFirst.map(c => {
//         const res = resultLookup[c.courseCode];
//         return {
//           courseCode: c.courseCode,
//           courseTitle: c.courseTitle,
//           credits: c.credits,
//           Total: res?.Total ?? null,
//           Grade: res?.Grade ?? "-",
//           CA: res?.CA ?? null,
//           Exam: res?.Exam ?? null,
//           semester: 1,
//         };
//       });

//       const secondCoursesWithGrades = coursesSecond.map(c => {
//         const res = resultLookup[c.courseCode];
//         return {
//           courseCode: c.courseCode,
//           courseTitle: c.courseTitle,
//           credits: c.credits,
//           Total: res?.Total ?? null,
//           Grade: res?.Grade ?? "-",
//           CA: res?.CA ?? null,
//           Exam: res?.Exam ?? null,
//           semester: 2,
//         };
//       });

//       // Identify repeat courses: results for this student in this session whose course.level != levelHandled
//       const repeatCourses = studentResults
//         .filter(r => r.level && Number(r.level) !== Number(levelHandled))
//         .map(r => ({ courseCode: r.courseCode, Total: r.Total, Grade: r.Grade, level: r.level }));

//       // Carried courses: CA-level courses (both sem) where Grade === 'F'
//       const carried = [...firstCoursesWithGrades, ...secondCoursesWithGrades]
//         .filter(c => c.Grade === "F")
//         .map(c => c.courseCode);

//       return {
//         sn: idx + 1,
//         studentUniqueId: reg.studentUniqueId,
//         matricNo: student?.matNumber,
//         fullName: `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
//         firstSem: firstCoursesWithGrades,
//         secondSem: secondCoursesWithGrades,
//         repeats: repeatCourses, // array of {courseCode, Total, Grade, level}
//         carried, // array of courseCodes with F among CA-level courses
//       };
//     });

//     // Response shape used by frontend:
//     // { session, levelHandled, courses: { first, second }, students: [...] }
//     return res.status(200).json({
//       session,
//       levelHandled,
//       courses: { first: coursesFirst, second: coursesSecond },
//       students,
//     });

//   } catch (err) {
//     console.error("Adviser result fetch error:", err);
//     return res.status(500).json({ error: "Failed to fetch adviser results", details: err.message });
//   }
// });


router.get("/adviser/results", authMiddleware, async (req, res) => {
  const { session } = req.query;

  try {
    const decoded = req.user;
    if (decoded.role !== "course_adviser") {
      return res.status(403).json({ error: "Access denied. Advisers only." });
    }

    if (!session) {
      return res.status(400).json({ error: "session query parameter required" });
    }

    // Find the adviser-session row for this adviser and session name
    const adviserSessionRow = await AdviserSession.findOne({
      where: { adviserId: decoded.id },
      include: [{ model: Session, as: "session", where: { sessionName: session }, attributes: ["id", "sessionName"] }],
    });

    if (!adviserSessionRow) {
      return res.status(404).json({ error: "No assigned session/level found for this adviser and session" });
    }

    const levelHandled = adviserSessionRow.levelHandled;

    // 1) Get all Courses belonging to that level (split into first/second)
    const levelCourses = await Courses.findAll({
      where: { level: levelHandled },
      attributes: ["id", "courseCode", "courseTitle", "credits", "semester", "level"],
      order: [["courseCode", "ASC"]],
    });

    const coursesFirst = levelCourses.filter(c => c.semester === 1).map(c => ({
      courseId: c.id,
      courseCode: c.courseCode,
      courseTitle: c.courseTitle,
      credits: c.credits,
    }));
    const coursesSecond = levelCourses.filter(c => c.semester === 2).map(c => ({
      courseId: c.id,
      courseCode: c.courseCode,
      courseTitle: c.courseTitle,
      credits: c.credits,
    }));

    // 2) Find all course registrations for this session and levelHandled
    const registrations = await CourseRegistration.findAll({
      where: { session, level: levelHandled },
      include: [
        { model: User, as: "student", attributes: ["unique_id", "matNumber", "firstName", "lastName"] },
        {
          model: Courses, // Include the courses via belongsToMany
          as: "courses",
          through: { attributes: [] }, // Exclude junction table attributes if not needed
          include: [
            {
              model: RegistrationCourses, // Include junction table
              as: "registrationCourses", // Match the as from hasMany in Courses
              attributes: ["semester"], // Specify fields you need from RegistrationCourses
            },
          ],
        },
      ],
    });

    // If no registrations, still return empty students list (but include courses)
    if (!registrations || registrations.length === 0) {
      return res.status(200).json({
        session,
        levelHandled,
        courses: { first: coursesFirst, second: coursesSecond },
        students: [],
      });
    }

    // 3) Collect student unique ids that we will need to fetch their results
    const studentIds = registrations.map(r => r.studentUniqueId);

    // 4) Fetch all Results for these students in this session
    const allResults = await Result.findAll({
      where: { session, studentUniqueId: { [Op.in]: studentIds } },
      include: [{ model: Courses, as: "course", attributes: ["courseCode", "level", "semester", "courseTitle", "credits"] }],
    });

    // Build results map: studentUniqueId -> array of results
    const resultsByStudent = {};
    allResults.forEach(r => {
      if (!resultsByStudent[r.studentUniqueId]) resultsByStudent[r.studentUniqueId] = [];
      resultsByStudent[r.studentUniqueId].push({
        courseCode: r.course.courseCode,
        Total: r.Total,
        Grade: r.Grade,
        CA: r.CA,
        Exam: r.Exam,
        level: r.course?.level ?? null,
        semester: r.course?.semester ?? null,
      });
    });

    // 5) Build students payload expected by frontend
    const students = registrations.map((reg, idx) => {
      const student = reg.student;
      const studentResults = resultsByStudent[reg.studentUniqueId] || [];

      // Build quick lookup by courseCode for student's results
      const resultLookup = {};
      studentResults.forEach(r => { resultLookup[r.courseCode] = r; });

      // For CA-level courses (first & second), map each course to the student's grade if exists
      const firstCoursesWithGrades = coursesFirst.map(c => {
        const res = resultLookup[c.courseCode];
        return {
          courseCode: c.courseCode,
          courseTitle: c.courseTitle,
          credits: c.credits,
          Total: res?.Total ?? null,
          Grade: res?.Grade ?? "-",
          CA: res?.CA ?? null,
          Exam: res?.Exam ?? null,
          semester: 1,
        };
      });

      const secondCoursesWithGrades = coursesSecond.map(c => {
        const res = resultLookup[c.courseCode];
        return {
          courseCode: c.courseCode,
          courseTitle: c.courseTitle,
          credits: c.credits,
          Total: res?.Total ?? null,
          Grade: res?.Grade ?? "-",
          CA: res?.CA ?? null,
          Exam: res?.Exam ?? null,
          semester: 2,
        };
      });

      // Identify repeat courses: results for this student in this session whose course.level != levelHandled
      const repeatCourses = studentResults
        .filter(r => r.level && Number(r.level) !== Number(levelHandled))
        .map(r => ({ courseCode: r.courseCode, Total: r.Total, Grade: r.Grade, level: r.level }));

      // Carried courses: CA-level courses (both sem) where Grade === 'F'
      const carried = [...firstCoursesWithGrades, ...secondCoursesWithGrades]
        .filter(c => c.Grade === "F")
        .map(c => c.courseCode);

      return {
        sn: idx + 1,
        studentUniqueId: reg.studentUniqueId,
        matricNo: student?.matNumber,
        fullName: `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
        firstSem: firstCoursesWithGrades,
        secondSem: secondCoursesWithGrades,
        repeats: repeatCourses,
        carried,
      };
    });

    // Response shape used by frontend
    return res.status(200).json({
      session,
      levelHandled,
      courses: { first: coursesFirst, second: coursesSecond },
      students,
    });
  } catch (err) {
    console.error("Adviser result fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch adviser results", details: err.message });
  }
});


module.exports = router;
