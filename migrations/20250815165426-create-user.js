"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Users", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      unique_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING,
      },
      matNumber: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      role: {
        allowNull: false,
        type: Sequelize.ENUM(
          "admin",
          "course_adviser",
          "lecturer",
          "student",
          "super_admin"
        ),
      },
      firstName: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      lastName: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      email: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING,
      },
      is_approved: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
      },
      is_deleted: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true, // It starts as NULL until soft-deleted
    },
      is_staff: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
      },
      currentSession: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      session: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      entryMode: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      courseAdviserLevel: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      level: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      gender: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      isActiveAdviser: {
        allowNull: false,
        defaultValue: false,
        type: Sequelize.BOOLEAN,
      },
      password: {
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
    await queryInterface.dropTable("Users");
  },
};
