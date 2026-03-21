import { Request, Response } from 'express';
import { MetricsService } from '../services/MetricsService';
import { exportCSVSchema, getMetricsQuerySchema, getTimeSeriesSchema } from '../validators/admin.validator';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { AuditLog } from '../models';

export class AdminDashboardController {
  static async getMetrics(req: Request, res: Response): Promise<Response> {
    try {
      const { value, error } = getMetricsQuerySchema.validate(req.query);
      if (error) return errorResponse(res, error.details[0].message, [], 400);
      const [business, operational, efficiency] = await Promise.all([
        MetricsService.getBusinessMetrics(value.period),
        MetricsService.getOperationalMetrics(),
        MetricsService.getEfficiencyMetrics(),
      ]);
      return successResponse(
        res,
        { business, operational, efficiency, generated_at: new Date() },
        'Admin metrics fetched'
      );
    } catch (e) {
      logger.error('AdminDashboardController.getMetrics failed', e);
      return errorResponse(res, 'ADMIN_METRICS_ERROR', [], 500);
    }
  }

  static async getTimeSeries(req: Request, res: Response): Promise<Response> {
    try {
      const { value, error } = getTimeSeriesSchema.validate(req.query);
      if (error) return errorResponse(res, error.details[0].message, [], 400);
      const data = await MetricsService.getTimeSeriesData(value.metric, value.period, value.granularity);
      return successResponse(res, data, 'Time series fetched');
    } catch (e) {
      logger.error('AdminDashboardController.getTimeSeries failed', e);
      return errorResponse(res, 'ADMIN_TIMESERIES_ERROR', [], 500);
    }
  }

  static async exportCSV(req: Request, res: Response): Promise<Response> {
    try {
      const { value, error } = exportCSVSchema.validate(req.query);
      if (error) return errorResponse(res, error.details[0].message, [], 400);
      const from = value.from ? new Date(value.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = value.to ? new Date(value.to) : new Date();
      const csv = await MetricsService.exportMetricsCSV({ type: value.type, from, to });
      const filename = `renters_${value.type}_${new Date().toISOString().slice(0, 10)}.csv`;
      await AuditLog.create({
        user_id: req.user?.id,
        action: 'admin.export.csv',
        details: { type: value.type, from, to } as unknown as object,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    } catch (e) {
      logger.error('AdminDashboardController.exportCSV failed', e);
      return errorResponse(res, 'ADMIN_EXPORT_ERROR', [], 500);
    }
  }
}
