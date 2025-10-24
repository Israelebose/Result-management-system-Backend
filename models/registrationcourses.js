'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RegistrationCourses extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
     // One registration course links one course
      RegistrationCourses.belongsTo(models.Courses, {
        foreignKey: "courseId",
        as: "course",
      });

      // And one student registration
      RegistrationCourses.belongsTo(models.CourseRegistration, {
        foreignKey: "registrationId",
        as: "registration",
      });
    }
  }
  RegistrationCourses.init({
    registrationId: DataTypes.INTEGER,
    courseId: DataTypes.INTEGER,
    semester: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'RegistrationCourses',
    timestamps: true,
  });
  return RegistrationCourses;
};