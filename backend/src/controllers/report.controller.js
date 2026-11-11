import { createExcelReport } from '../services/report.service.js';

export async function downloadExcel(req, res) {
  const buffer = await createExcelReport(req.session.user);
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="aplicaciones-aereas.xlsx"');
  res.end(buffer);
}
