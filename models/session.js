"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Session extends Model {
    static associate(models) {
      // A session can have many AdviserSessions
      Session.hasMany(models.AdviserSession, {
        foreignKey: "sessionId",
        as: "advisers",
      });

      // Uncomment and adjust these if implemented
      // Session.hasMany(models.CourseRegistration, {
      //   foreignKey: "sessionId", // Adjust foreignKey to match your schema
      //   sourceKey: "id", // Use 'id' instead of 'name' if that's the primary key
      //   as: "registrations",
      // });

      // Session.hasMany(models.Result, {
      //   foreignKey: "sessionId", // Adjust foreignKey to match your schema
      //   sourceKey: "id", // Use 'id' instead of 'name'
      //   as: "results",
      // });
    }
  }
  Session.init(
    {
      sessionName: DataTypes.STRING,
      isCurrent: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Session",
      timestamps: true,
    }
  );
  return Session;
};