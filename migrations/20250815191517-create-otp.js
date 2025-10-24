"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Otps", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      unique_id: {
        unique: true,
        allowNull: false,
        type: Sequelize.STRING,
      },
      otp: {
        type: Sequelize.TEXT,
      },
      expiresAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      used: {
        defaultValue: false,
        type: Sequelize.BOOLEAN,
      },
      type: {
        defaultValue: "password_reset",
        type: Sequelize.STRING,
      },
      email: {
        unique: true,
        allowNull: false,
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Otps");
  },
};
