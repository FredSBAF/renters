import { Sequelize } from 'sequelize';
import { config } from './env';

export const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  dialectOptions: { charset: 'utf8mb4' },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    underscored: true,
    timestamps: true,
  },
  logging: config.env === 'test' ? false : undefined,
});
