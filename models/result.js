'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Result extends Model {
    static associate(models) {
      // A Result belongs to a student
      Result.belongsTo(models.User, {
        foreignKey: 'studentUniqueId',
        targetKey: 'unique_id',
        as: 'student',
      });

      // A Result belongs to a course
      Result.belongsTo(models.Courses, {
        foreignKey: 'courseCode',
        targetKey: 'courseCode',
        as: 'course',
      });
    }
  }

  Result.init(
    {
      studentUniqueId: DataTypes.STRING,
      courseCode: DataTypes.STRING,
      CA: DataTypes.INTEGER,
      Exam: DataTypes.INTEGER,
      Total: DataTypes.INTEGER,
      Grade: DataTypes.STRING,
      session: DataTypes.STRING,
      published: DataTypes.BOOLEAN,
      level: DataTypes.INTEGER, 
    },
    {
      sequelize,
      modelName: 'Result',
      timestamps: true,
    }
  );

  return Result;
};
