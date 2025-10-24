"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // A User (lecturer) can teach many Courses
      User.belongsToMany(models.Courses, {
        through: "CourseLecturers", // join table
        foreignKey: "lecturerUniqueId", // column in join table pointing to User
        otherKey: "courseCode", // column in join table pointing to Course
        sourceKey: "unique_id", // User field used
        targetKey: "courseCode", // Course field used
        as: "courses",
      });

      User.hasMany(models.CourseRegistration, {
        foreignKey: "studentUniqueId",
        sourceKey: "unique_id",
        as: "registrations",
      });

      User.hasMany(models.AdviserSession, {
        foreignKey: "adviserId",
        as: "adviserSessions",
      });
    }
  }

  User.init(
    {
      unique_id: DataTypes.STRING,
      matNumber: DataTypes.STRING,
      role: DataTypes.ENUM("admin", "course_adviser", "lecturer", "student"),
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
      email: DataTypes.STRING,
      entryMode: DataTypes.STRING,
      is_approved: DataTypes.BOOLEAN,
      is_deleted: DataTypes.BOOLEAN,
      is_staff: DataTypes.BOOLEAN,
      currentSession: DataTypes.STRING,
      session: DataTypes.STRING,
      courseAdviserLevel: DataTypes.INTEGER,
      level: DataTypes.INTEGER,
      password: DataTypes.STRING,
      gender: DataTypes.STRING,
      deleted_at: DataTypes.DATE,
      isActiveAdviser: DataTypes.BOOLEAN
    },
    {
      sequelize,
      modelName: "User",
      timestamps: true,
    }
  );

  return User;
};
