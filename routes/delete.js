const express  = require("express");
const authMiddleware = require("../middleware/authMiddleware.js");
const { User, Courses } = require("../models"); // Import models
const router  = express.Router();   


/** -----------------------------
 * DELETE COURSE
 * ----------------------------- */
router.delete("/delete-course/:courseCode", authMiddleware, async (req, res) => {
  try {
    const { courseCode } = req.params;

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const course = await Courses.findOne({ where: { courseCode } });
    if (!course) return res.status(404).json({ error: "Course not found" });

    await course.setLecturers([]); // remove relationships
    await course.destroy();

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete course" });
  }
});

module.exports = router;