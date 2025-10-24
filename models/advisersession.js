"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class AdviserSession extends Model {
    static associate(models) {
      // AdviserSession belongs to a course adviser (User)
      AdviserSession.belongsTo(models.User, {
        foreignKey: "adviserId",
        as: "adviser",
      });

      // AdviserSession belongs to a session
      AdviserSession.belongsTo(models.Session, {
        foreignKey: "sessionId",
        as: "session",
      });
    }
  }
  AdviserSession.init(
    {
      adviserId: DataTypes.INTEGER,
      sessionId: DataTypes.INTEGER,
      levelHandled: DataTypes.INTEGER,
      published: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "AdviserSession",
      timestamps: true,
    }
  );
  return AdviserSession;
};