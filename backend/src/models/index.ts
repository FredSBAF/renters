import { Agency } from './Agency';
import { User } from './User';
import { RefreshToken } from './RefreshToken';
import { EmailVerificationToken } from './EmailVerificationToken';
import { PasswordResetToken } from './PasswordResetToken';
import { UserConsent } from './UserConsent';
import { PaymentLog } from './PaymentLog';
import { Folder } from './Folder';
import { DocumentType } from './DocumentType';
import { Document } from './Document';
import { AuditLog } from './AuditLog';
import { SharingLink } from './SharingLink';
import { SharingView } from './SharingView';
import { Guarantor } from './Guarantor';
import { ModerationQueue } from './ModerationQueue';
import { Notification } from './Notification';
import { NotificationPreference } from './NotificationPreference';
import { SearchCriteria } from './SearchCriteria';
import { SearchCriteriaCity } from './SearchCriteriaCity';
import { SearchCriteriaPropertyType } from './SearchCriteriaPropertyType';

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
Document.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' });
Folder.hasMany(Document, { foreignKey: 'folder_id', as: 'documents' });
Document.belongsTo(DocumentType, { foreignKey: 'document_type', targetKey: 'code', as: 'type' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AuditLog.belongsTo(Agency, { foreignKey: 'agency_id', as: 'agency' });
SharingLink.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' });
Folder.hasMany(SharingLink, { foreignKey: 'folder_id', as: 'sharingLinks' });
SharingView.belongsTo(SharingLink, { foreignKey: 'sharing_link_id', as: 'sharingLink' });
SharingLink.hasMany(SharingView, { foreignKey: 'sharing_link_id', as: 'views' });
SharingView.belongsTo(Agency, { foreignKey: 'agency_id', as: 'agency' });
Guarantor.belongsTo(User, { foreignKey: 'tenant_id', as: 'tenant' });
Guarantor.belongsTo(User, { foreignKey: 'guarantor_user_id', as: 'guarantorUser' });
Guarantor.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' });
User.hasMany(Guarantor, { foreignKey: 'tenant_id', as: 'guarantors' });
ModerationQueue.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' });
ModerationQueue.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedAdmin' });
ModerationQueue.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolvedBy' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
NotificationPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(NotificationPreference, { foreignKey: 'user_id', as: 'notificationPreference' });
SearchCriteria.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(SearchCriteria, { foreignKey: 'user_id', as: 'searchCriteria' });
SearchCriteria.hasMany(SearchCriteriaCity, {
  foreignKey: 'search_criteria_id',
  as: 'cities',
  onDelete: 'CASCADE',
});
SearchCriteriaCity.belongsTo(SearchCriteria, { foreignKey: 'search_criteria_id', as: 'criteria' });
SearchCriteria.hasMany(SearchCriteriaPropertyType, {
  foreignKey: 'search_criteria_id',
  as: 'propertyTypes',
  onDelete: 'CASCADE',
});
SearchCriteriaPropertyType.belongsTo(SearchCriteria, {
  foreignKey: 'search_criteria_id',
  as: 'criteria',
});

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
  Document,
  AuditLog,
  SharingLink,
  SharingView,
  Guarantor,
  ModerationQueue,
  Notification,
  NotificationPreference,
  SearchCriteria,
  SearchCriteriaCity,
  SearchCriteriaPropertyType,
};
