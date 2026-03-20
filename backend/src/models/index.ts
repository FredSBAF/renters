import { Agency } from './Agency';
import { User } from './User';
import { RefreshToken } from './RefreshToken';
import { EmailVerificationToken } from './EmailVerificationToken';
import { PasswordResetToken } from './PasswordResetToken';
import { UserConsent } from './UserConsent';
import { PaymentLog } from './PaymentLog';
import { Folder } from './Folder';
import { DocumentType } from './DocumentType';

User.belongsTo(Agency, { foreignKey: 'agency_id' });
Agency.hasMany(User, { foreignKey: 'agency_id' });

RefreshToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(RefreshToken, { foreignKey: 'user_id' });

EmailVerificationToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(EmailVerificationToken, { foreignKey: 'user_id' });

PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(PasswordResetToken, { foreignKey: 'user_id' });

UserConsent.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(UserConsent, { foreignKey: 'user_id' });

PaymentLog.belongsTo(Agency, { foreignKey: 'agency_id' });
Agency.hasMany(PaymentLog, { foreignKey: 'agency_id' });

Folder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(Folder, { foreignKey: 'user_id', as: 'folder' });
// TODO Part 5: Folder.hasMany(Document, { foreignKey: 'folder_id', as: 'documents' });
// DocumentType is a static reference table; no direct association.

export {
  Agency,
  User,
  RefreshToken,
  EmailVerificationToken,
  PasswordResetToken,
  UserConsent,
  PaymentLog,
  Folder,
  DocumentType,
};
