'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CourseRegistration extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
     static associate(models) {
      // Each registration belongs to one student
      CourseRegistration.belongsTo(models.User, {
        foreignKey: "studentUniqueId",
        targetKey: "unique_id",
        as: "student",
      });

      // Each registration can have many courses through RegistrationCourses
      CourseRegistration.belongsToMany(models.Courses, {
        through: "RegistrationCourses",
        foreignKey: "registrationId",
        otherKey: "courseId",
        as: "courses",
      });
    }
  }
  CourseRegistration.init({
    studentUniqueId: DataTypes.STRING,
    session: DataTypes.STRING,
    level: DataTypes.INTEGER,
    totalCredit: DataTypes.INTEGER,
    status: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'CourseRegistration',
    timestamps: true,
  });
  return CourseRegistration;
};