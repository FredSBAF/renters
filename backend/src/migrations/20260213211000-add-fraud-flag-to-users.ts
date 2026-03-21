import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('users', 'is_fraud_flagged', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('users', 'is_fraud_flagged');
  },
};
