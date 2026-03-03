'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'first_name', {
      type: Sequelize.DataTypes.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'last_name', {
      type: Sequelize.DataTypes.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'phone', {
      type: Sequelize.DataTypes.STRING(32),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'date_of_birth', {
      type: Sequelize.DataTypes.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'first_name');
    await queryInterface.removeColumn('users', 'last_name');
    await queryInterface.removeColumn('users', 'phone');
    await queryInterface.removeColumn('users', 'date_of_birth');
  },
};
