'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CourseLecturers", {
      lecturerUniqueId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: "Users", key: "unique_id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      courseCode: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: "Courses", key: "courseCode" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW")
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW")
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("CourseLecturers");
  }
};
