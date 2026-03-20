import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../config/database';
import {
  Agency,
  EmailVerificationToken,
  User,
  UserConsent,
} from '../models';
import { sendAgencyInvitationEmail, sendVerificationEmail } from './EmailService';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;

type RegisterAgencyInput = {
  name: string;
  siret: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone: string;
  owner_email: string;
  owner_password: string;
};

type SafeUser = {
  id: number;
  email: string;
  role: string;
  agency_id?: number | null;
  status?: string;
};

export class AgencyService {
  static async registerAgency(
    data: RegisterAgencyInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ agency: Agency; owner: SafeUser }> {
    const existingAgency = await Agency.findOne({ where: { siret: data.siret } });
    if (existingAgency) {
      throw new Error('DUPLICATE_SIRET');
    }

    const ownerEmail = data.owner_email.toLowerCase();
    const existingOwner = await User.findOne({ where: { email: ownerEmail } });
    if (existingOwner) {
      throw new Error('DUPLICATE_EMAIL');
    }

    const result = await sequelize.transaction(async (transaction) => {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      const agency = await Agency.create(
        {
          name: data.name,
          siret: data.siret,
          address: data.address ?? null,
          phone: data.phone,
          status: 'trial',
          trial_ends_at: trialEndsAt,
        },
        { transaction }
      );

      const password_hash = await bcrypt.hash(data.owner_password, SALT_ROUNDS);
      const owner = await User.create(
        {
          email: ownerEmail,
          password_hash,
          role: 'agency_owner',
          status: 'pending_verification',
          agency_id: agency.id,
          first_name: null,
          last_name: null,
          phone: data.phone,
        },
        { transaction }
      );

      const verificationToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await EmailVerificationToken.create(
        {
          user_id: owner.id,
          token: verificationToken,
          expires_at: expiresAt,
        },
        { transaction }
      );

      await UserConsent.bulkCreate(
        [
          {
            user_id: owner.id,
            consent_type: 'data_storage',
            ip_address: ip ?? null,
            user_agent: userAgent ?? null,
          },
          {
            user_id: owner.id,
            consent_type: 'data_sharing',
            ip_address: ip ?? null,
            user_agent: userAgent ?? null,
          },
          {
            user_id: owner.id,
            consent_type: 'ml_training',
            ip_address: ip ?? null,
            user_agent: userAgent ?? null,
          },
        ],
        { transaction }
      );

      return { agency, owner, verificationToken };
    });

    await sendVerificationEmail(result.owner.email, result.verificationToken);
    logger.info(`Agency created: ${result.agency.id} (${result.agency.siret})`);

    const ownerJson = result.owner.toJSON() as SafeUser;

    return {
      agency: result.agency,
      owner: ownerJson,
    };
  }

  static async inviteAgent(
    agencyId: number,
    email: string,
    invitedByUserId: number
  ): Promise<void> {
    const agency = await Agency.findByPk(agencyId);
    if (!agency || !['trial', 'active'].includes(agency.status)) {
      throw new Error('AGENCY_NOT_ACTIVE');
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser && existingUser.agency_id && existingUser.agency_id !== agencyId) {
      throw new Error('EMAIL_ALREADY_USED');
    }

    if (existingUser) {
      if (existingUser.agency_id === agencyId) {
        throw new Error('ALREADY_IN_AGENCY');
      }
      await existingUser.update({ agency_id: agencyId, role: 'agency_agent' });
      logger.info(
        `Audit invite-agent auto-attach: agency=${agencyId} agent=${existingUser.id} by=${invitedByUserId}`
      );
      return;
    }

    const payload = Buffer.from(
      JSON.stringify({
        t: 'agent_invitation',
        agencyId,
        email: normalizedEmail,
      })
    ).toString('base64url');
    const token = `agent_invitation:${uuidv4()}:${payload}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await EmailVerificationToken.create({
      user_id: invitedByUserId,
      token,
      expires_at: expiresAt,
    });

    logger.info(`Audit invite-agent created: agency=${agencyId} email=${normalizedEmail} by=${invitedByUserId}`);

    await sendAgencyInvitationEmail(normalizedEmail, token);
  }

  static async removeAgent(
    agencyId: number,
    agentUserId: number,
    requestingUserId: number
  ): Promise<void> {
    const owner = await User.findByPk(requestingUserId);
    if (!owner || owner.role !== 'agency_owner' || owner.agency_id !== agencyId) {
      throw new Error('FORBIDDEN');
    }

    if (agentUserId === requestingUserId) {
      throw new Error('CANNOT_REMOVE_SELF');
    }

    const agent = await User.findByPk(agentUserId);
    if (!agent || agent.agency_id !== agencyId) {
      throw new Error('AGENT_NOT_FOUND');
    }

    await agent.update({ agency_id: null, role: 'tenant' });
    logger.info(`Audit remove-agent: agency=${agencyId} agent=${agentUserId} by=${requestingUserId}`);
  }

  static async getAgencyTeam(agencyId: number): Promise<SafeUser[]> {
    const users = await User.findAll({
      where: { agency_id: agencyId },
      attributes: { exclude: ['password_hash', 'totp_secret'] },
      order: [['created_at', 'ASC']],
    });
    return users.map((u) => u.toJSON() as SafeUser);
  }

  static async joinAgencyByToken(token: string): Promise<SafeUser> {
    const invitation = await EmailVerificationToken.findOne({ where: { token } });
    if (!invitation || invitation.used_at || new Date() > invitation.expires_at) {
      throw new Error('INVALID_TOKEN');
    }

    const parts = token.split(':');
    if (parts.length < 3 || parts[0] !== 'agent_invitation') {
      throw new Error('INVALID_TOKEN');
    }

    const parsed = JSON.parse(Buffer.from(parts[2], 'base64url').toString('utf8')) as {
      t: string;
      agencyId: number;
      email: string;
    };
    if (parsed.t !== 'agent_invitation' || !parsed.agencyId || !parsed.email) {
      throw new Error('INVALID_TOKEN');
    }

    const result = await sequelize.transaction(async (transaction) => {
      const agency = await Agency.findByPk(parsed.agencyId, { transaction });
      if (!agency) throw new Error('AGENCY_NOT_FOUND');

      let user = await User.findOne({
        where: { email: parsed.email.toLowerCase() },
        transaction,
      });

      if (!user) {
        const randomPasswordHash = await bcrypt.hash(uuidv4(), SALT_ROUNDS);
        user = await User.create(
          {
            email: parsed.email.toLowerCase(),
            password_hash: randomPasswordHash,
            role: 'agency_agent',
            status: 'pending_verification',
            agency_id: parsed.agencyId,
          },
          { transaction }
        );
      } else {
        await user.update(
          {
            agency_id: parsed.agencyId,
            role: 'agency_agent',
          },
          { transaction }
        );
      }

      await invitation.update({ used_at: new Date() }, { transaction });
      return user;
    });

    const userJson = result.toJSON() as SafeUser;
    return userJson;
  }

  static async getAgencyById(agencyId: number): Promise<Agency> {
    const agency = await Agency.findByPk(agencyId, {
      include: [
        {
          model: User,
          attributes: { exclude: ['password_hash', 'totp_secret'] },
        },
      ],
      order: [[User, 'created_at', 'ASC']],
    });

    if (!agency) {
      throw new Error('AGENCY_NOT_FOUND');
    }
    return agency;
  }
}
