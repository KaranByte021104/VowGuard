import { Controller, Get, Req, UseGuards, Res, Query, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getDashboardStats(@Req() req) {
    return this.reportsService.getDashboardStats(req.user.organizationId);
  }

  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Get('export')
  async exportReport(@Req() req, @Res() res: Response, @Query('format') format: string) {
    const data = await this.reportsService.getDashboardStats(req.user.organizationId);

    if (format === 'csv') {
      const flatData = [
        { Metric: 'Total Users', Value: data.userAccess?.total || 0 },
        { Metric: 'Total Secrets', Value: data.passwordAccess?.total || 0 },
        { Metric: 'Total Shares', Value: data.sharing?.total || 0 },
        { Metric: 'Audit Events', Value: data.auditEvents || 0 }
      ];
      const parser = new Parser();
      const csv = parser.parse(flatData);
      res.header('Content-Type', 'text/csv');
      res.attachment('report.csv');
      return res.send(csv);
    } else if (format === 'pdf') {
      const doc = new PDFDocument();
      res.header('Content-Type', 'application/pdf');
      res.attachment('report.pdf');
      
      doc.pipe(res);
      doc.fontSize(25).text('SecureVault Organization Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Total Users: ${data.userAccess?.total || 0}`);
      doc.text(`Total Secrets: ${data.passwordAccess?.total || 0}`);
      doc.text(`Total Shares: ${data.sharing?.total || 0}`);
      doc.text(`Audit Events: ${data.auditEvents || 0}`);
      doc.end();
    } else {
      throw new BadRequestException('Format must be csv or pdf');
    }
  }
}
