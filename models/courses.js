"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Courses extends Model {
    static associate(models) {
      // Lecturers association
      Courses.belongsToMany(models.User, {
        through: "CourseLecturers",
        foreignKey: "courseCode",
        otherKey: "lecturerUniqueId",
        sourceKey: "courseCode",
        targetKey: "unique_id",
        as: "lecturers",
      });

      // Add relation to registration join table
      Courses.belongsToMany(models.CourseRegistration, {
        through: "RegistrationCourses",
        foreignKey: "courseId",
        otherKey: "registrationId",
        as: "registrations",
      });

      // Add hasMany association to RegistrationCourses
      Courses.hasMany(models.RegistrationCourses, {
        foreignKey: "courseId",
        as: "registrationCourses", // Custom alias for the junction table
      })
    }
  }

  Courses.init(
    {
      courseCode: DataTypes.STRING,
      courseTitle: DataTypes.STRING,
      credits: DataTypes.INTEGER,
      level: DataTypes.INTEGER,
      semester: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Courses",
      timestamps: true
    }
  );

  return Courses;
};
