const express  = require("express");
const authMiddleware = require("../middleware/authMiddleware.js");
const { User, Courses } = require("../models"); // Import models
const router  = express.Router();   


/** -----------------------------
 * EDIT COURSE
 * ----------------------------- */
router.put("/edit-course/:courseCode", authMiddleware, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { courseTitle, credits, level, semester, lecturerIds } = req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const course = await Courses.findOne({ where: { courseCode } });
    if (!course) return res.status(404).json({ error: "Course not found" });

    await course.update({ courseTitle, credits, level, semester });

    // Update assigned lecturers if provided
    if (lecturerIds) {
      const lecturers = await User.findAll({
        where: { unique_id: lecturerIds, is_staff: true },
      });
      await course.setLecturers(lecturers);
    }

    const updatedCourse = await Courses.findOne({
      where: { courseCode },
      include: [{ model: User, as: "lecturers", attributes: ["unique_id", "firstName", "lastName", "email"] }],
    });

    res.status(200).json({ message: "Course updated successfully", course: updatedCourse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to edit course" });
  }
});

module.exports = router;