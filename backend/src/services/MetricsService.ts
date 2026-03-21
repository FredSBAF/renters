import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { Agency, AuditLog, Folder, PaymentLog, SharingLink, User } from '../models';

type Period = 'day' | 'week' | 'month';

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === 'day') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

function percent(a: number, b: number): number {
  if (!b) return 0;
  return Number(((a / b) * 100).toFixed(2));
}

function formatDateFR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

export class MetricsService {
  static async getBusinessMetrics(period: Period = 'month'): Promise<Record<string, unknown>> {
    const start = getPeriodStart(period);
    const prevStart = new Date(start.getTime() - (new Date().getTime() - start.getTime()));

    const [
      totalTenants,
      activeTenants,
      newTenants,
      prevTenants,
      totalFolders,
      completeFolders,
      verifiedFolders,
      activeFolders,
      completeWithShare,
      payingAgencies,
      trialAgencies,
      suspendedAgencies,
      cancelledAgencies,
      newAgencies,
      totalCollectedCents,
    ] = await Promise.all([
      User.count({ where: { role: 'tenant' } }),
      User.count({ where: { role: 'tenant', status: 'active' } }),
      User.count({ where: { role: 'tenant', created_at: { [Op.gte]: start } } }),
      User.count({
        where: { role: 'tenant', created_at: { [Op.between]: [prevStart, start] } },
      }),
      Folder.count(),
      Folder.count({ where: { status: 'complete' } }),
      Folder.count({ where: { status: 'verified' } }),
      Folder.count({ where: { folder_status: 'active' } }),
      SharingLink.count(),
      Agency.count({ where: { status: 'active' } }),
      Agency.count({ where: { status: 'trial' } }),
      Agency.count({ where: { status: 'suspended' } }),
      Agency.count({ where: { status: 'cancelled' } }),
      Agency.count({ where: { created_at: { [Op.gte]: start } } }),
      PaymentLog.sum('amount', {
        where: { status: 'success', created_at: { [Op.gte]: start } },
      }),
    ]);

    const conversionRate = percent(payingAgencies, payingAgencies + trialAgencies);
    const churnRate = percent(cancelledAgencies, payingAgencies + cancelledAgencies);
    const mrr = payingAgencies * 300;

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        new_this_period: newTenants,
        growth_rate: percent(newTenants - prevTenants, Math.max(prevTenants, 1)),
      },
      folders: {
        total: totalFolders,
        complete: completeFolders,
        verified: verifiedFolders,
        active: activeFolders,
        completion_rate: percent(completeFolders, totalFolders),
        sharing_rate: percent(completeWithShare, Math.max(completeFolders, 1)),
      },
      agencies: {
        paying: payingAgencies,
        trial: trialAgencies,
        suspended: suspendedAgencies,
        cancelled: cancelledAgencies,
        new_this_period: newAgencies,
        conversion_rate: conversionRate,
        churn_rate: churnRate,
      },
      revenue: {
        mrr,
        arr: mrr * 12,
        total_collected: Number(((Number(totalCollectedCents || 0)) / 100).toFixed(2)),
      },
    };
  }

  static async getOperationalMetrics(): Promise<Record<string, unknown>> {
    const [pending, inReview, breached, avgResHours, rejected, analyzed, aiAvgTime, pendingAi, totalUploaded, totalExpired, downloaded] =
      await Promise.all([
        sequelize.query(`SELECT COUNT(*) as c FROM moderation_queue WHERE status='pending'`, { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT COUNT(*) as c FROM moderation_queue WHERE status='in_review'`, { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT COUNT(*) as c FROM moderation_queue WHERE sla_breached=1`, { type: QueryTypes.SELECT }),
        sequelize.query(
          `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as v FROM moderation_queue WHERE resolved_at IS NOT NULL`,
          { type: QueryTypes.SELECT }
        ),
        Folder.count({ where: { ai_status: 'rejected' } }),
        Folder.count({ where: { ai_status: { [Op.in]: ['analyzed', 'manual_review', 'rejected'] } } }),
        sequelize.query(
          `SELECT AVG(JSON_EXTRACT(details, '$.analysis_time_ms')) as v FROM audit_logs WHERE action='folder.ai_analyzed'`,
          { type: QueryTypes.SELECT }
        ),
        Folder.count({ where: { ai_status: 'pending' } }),
        sequelize.query(`SELECT COUNT(*) as c FROM documents`, { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT COUNT(*) as c FROM documents WHERE status='expired'`, { type: QueryTypes.SELECT }),
        AuditLog.count({ where: { action: 'document.downloaded.agency' } }),
      ]);

    const getCount = (rows: unknown) => Number((rows as Array<{ c: number }>)[0]?.c || 0);
    const getAvg = (rows: unknown) => Number((rows as Array<{ v: number }>)[0]?.v || 0);

    return {
      moderation: {
        pending_count: getCount(pending),
        in_review_count: getCount(inReview),
        sla_breached_count: getCount(breached),
        avg_resolution_time_hours: getAvg(avgResHours),
      },
      ai: {
        fraud_rate: percent(rejected, Math.max(analyzed, 1)),
        false_positive_rate: 0,
        avg_analysis_time_ms: getAvg(aiAvgTime),
        pending_analysis: pendingAi,
      },
      documents: {
        total_uploaded: getCount(totalUploaded),
        total_expired: getCount(totalExpired),
        total_downloaded_by_agencies: downloaded,
      },
    };
  }

  static async getEfficiencyMetrics(): Promise<Record<string, unknown>> {
    const [avgCompletion, avgShare, avgViewed, avgDownloads] = await Promise.all([
      sequelize.query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, first_upload, validated_at)) as v
         FROM (
           SELECT a1.entity_id as folder_id,
                  MIN(a1.created_at) as first_upload,
                  MAX(a2.created_at) as validated_at
           FROM audit_logs a1
           JOIN audit_logs a2 ON a1.entity_id = a2.entity_id
           WHERE a1.action='document.uploaded' AND a2.action='folder.ai_validated'
           GROUP BY a1.entity_id
         ) t`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT AVG(TIMESTAMPDIFF(DAY, f.created_at, sl.created_at)) as v
         FROM folders f JOIN sharing_links sl ON sl.folder_id=f.id`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT AVG(cnt) as v FROM (
           SELECT agency_id, COUNT(*) as cnt FROM sharing_views WHERE agency_id IS NOT NULL GROUP BY agency_id
         ) t`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT AVG(cnt) as v FROM (
           SELECT agency_id, COUNT(*) as cnt FROM audit_logs
           WHERE action='document.downloaded.agency' AND agency_id IS NOT NULL
           GROUP BY agency_id
         ) t`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    const avg = (rows: unknown) => Number((rows as Array<{ v: number }>)[0]?.v || 0);

    return {
      avg_folder_completion_time_minutes: avg(avgCompletion),
      avg_time_to_share_days: avg(avgShare),
      top_document_types_missing: [],
      agency_activity: {
        avg_folders_viewed_per_agency: avg(avgViewed),
        avg_documents_downloaded_per_agency: avg(avgDownloads),
      },
    };
  }

  static async getTimeSeriesData(
    metric: string,
    period: 'week' | 'month' | 'year',
    granularity: 'day' | 'week' | 'month'
  ): Promise<Array<{ date: string; value: number }>> {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let sql = '';
    if (metric === 'new_tenants') {
      sql = `SELECT DATE(created_at) as date, COUNT(*) as value FROM users
             WHERE role='tenant' AND created_at >= :start GROUP BY DATE(created_at) ORDER BY DATE(created_at)`;
    } else if (metric === 'new_agencies') {
      sql = `SELECT DATE(created_at) as date, COUNT(*) as value FROM agencies
             WHERE created_at >= :start GROUP BY DATE(created_at) ORDER BY DATE(created_at)`;
    } else if (metric === 'folders_verified') {
      sql = `SELECT DATE(updated_at) as date, COUNT(*) as value FROM folders
             WHERE status='verified' AND updated_at >= :start GROUP BY DATE(updated_at) ORDER BY DATE(updated_at)`;
    } else if (metric === 'revenue') {
      sql = `SELECT DATE(created_at) as date, SUM(amount)/100 as value FROM payment_logs
             WHERE status='success' AND created_at >= :start GROUP BY DATE(created_at) ORDER BY DATE(created_at)`;
    } else if (metric === 'fraud_detected') {
      sql = `SELECT DATE(updated_at) as date, COUNT(*) as value FROM folders
             WHERE ai_status='rejected' AND updated_at >= :start GROUP BY DATE(updated_at) ORDER BY DATE(updated_at)`;
    } else {
      return [];
    }

    const rows = (await sequelize.query(sql, {
      replacements: { start },
      type: QueryTypes.SELECT,
    })) as Array<{ date: string; value: number }>;

    const map = new Map(rows.map((r) => [r.date.slice(0, 10), Number(r.value)]));
    const result: Array<{ date: string; value: number }> = [];
    for (let i = 0; i < days; i += granularity === 'week' ? 7 : granularity === 'month' ? 30 : 1) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, value: map.get(key) ?? 0 });
    }
    return result;
  }

  static async exportMetricsCSV(params: {
    type: 'tenants' | 'agencies' | 'folders' | 'revenue';
    from: Date;
    to: Date;
  }): Promise<string> {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];

    if (params.type === 'tenants') {
      lines.push('id;email;status;tenant_profile;created_at;folder_status;completion_percentage;ai_score_global;is_fraud_flagged');
      const tenants = await User.findAll({ where: { role: 'tenant', created_at: { [Op.between]: [params.from, params.to] } } });
      for (const t of tenants) {
        lines.push(
          [
            esc(t.id),
            esc(t.email),
            esc(t.status),
            esc(t.tenant_profile),
            esc(formatDateFR(new Date(t.created_at))),
            esc(''),
            esc(''),
            esc(''),
            esc((t as unknown as { is_fraud_flagged?: boolean }).is_fraud_flagged ?? false),
          ].join(';')
        );
      }
    } else if (params.type === 'agencies') {
      lines.push('id;name;siret;status;trial_ends_at;subscription_id;next_billing_date;created_at;agents_count;folders_viewed_count');
      const agencies = await Agency.findAll({ where: { created_at: { [Op.between]: [params.from, params.to] } } });
      for (const a of agencies) {
        lines.push(
          [
            esc(a.id),
            esc(a.name),
            esc(a.siret),
            esc(a.status),
            esc(a.trial_ends_at),
            esc(a.subscription_id),
            esc(a.next_billing_date),
            esc(formatDateFR(new Date(a.created_at))),
            esc(0),
            esc(0),
          ].join(';')
        );
      }
    } else if (params.type === 'folders') {
      lines.push('id;tenant_email;status;completion_percentage;ai_score_global;ai_status;created_at;expires_at;sharing_links_count');
      const folders = await Folder.findAll({ where: { created_at: { [Op.between]: [params.from, params.to] } } });
      for (const f of folders) {
        const user = await User.findByPk(f.user_id);
        lines.push(
          [
            esc(f.id),
            esc(user?.email ?? ''),
            esc(f.status),
            esc(f.completion_percentage),
            esc(f.ai_score_global),
            esc(f.ai_status),
            esc(formatDateFR(new Date(f.created_at))),
            esc(f.expires_at),
            esc(0),
          ].join(';')
        );
      }
    } else {
      lines.push('date;agency_name;event_type;amount_eur;status');
      const logs = await PaymentLog.findAll({
        where: { created_at: { [Op.between]: [params.from, params.to] } },
      });
      for (const l of logs) {
        const agency = l.agency_id ? await Agency.findByPk(l.agency_id) : null;
        lines.push(
          [
            esc(formatDateFR(new Date(l.created_at))),
            esc(agency?.name ?? ''),
            esc(l.event_type),
            esc((Number(l.amount || 0) / 100).toFixed(2)),
            esc(l.status),
          ].join(';')
        );
      }
    }

    return `\ufeff${lines.join('\n')}`;
  }
}
