'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Otp extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Otp.init({
    unique_id: DataTypes.STRING,
    otp: DataTypes.TEXT,
    expiresAt: DataTypes.DATE,
    used: DataTypes.BOOLEAN,
    type: DataTypes.STRING,
    email: DataTypes.STRING,
   
  }, {
    sequelize,
    modelName: 'Otp',
    timestamps: true,
  });
  return Otp;
};