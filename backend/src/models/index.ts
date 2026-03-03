import { Agency } from './Agency';
import { User } from './User';
import { RefreshToken } from './RefreshToken';
import { EmailVerificationToken } from './EmailVerificationToken';
import { PasswordResetToken } from './PasswordResetToken';

User.belongsTo(Agency, { foreignKey: 'agency_id' });
Agency.hasMany(User, { foreignKey: 'agency_id' });

RefreshToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(RefreshToken, { foreignKey: 'user_id' });

EmailVerificationToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(EmailVerificationToken, { foreignKey: 'user_id' });

PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(PasswordResetToken, { foreignKey: 'user_id' });

export { Agency, User, RefreshToken, EmailVerificationToken, PasswordResetToken };
