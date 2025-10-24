'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Results', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      studentUniqueId: {
        type: Sequelize.STRING
      },
      courseCode: {
        type: Sequelize.STRING
      },
      CA: {
        type: Sequelize.INTEGER
      },
      Exam: {
        type: Sequelize.INTEGER
      },
      Total: {
        type: Sequelize.INTEGER
      },
      Grade: {
        type: Sequelize.STRING
      },
      session: {
        type: Sequelize.STRING
      },
      published: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      level: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Results');
  }
};