import { ReportRepository } from "../../infrastructure/repositories/ReportRepository.js";

export class ReportService {
  private reportRepo = new ReportRepository();

  async getReportsByProject(projectId: string) {
    return await this.reportRepo.getReportsByProjectId(projectId);
  }

  async getReportById(id: string) {
    const report = await this.reportRepo.getReportById(id);
    if (!report) {
      throw new Error("Không tìm thấy báo cáo");
    }
    return report;
  }

  async createReport(reportData: any) {
    if (!reportData.projectId || !reportData.title || !reportData.content) {
      throw new Error("Thiếu thông tin bắt buộc");
    }

    const reportId = await this.reportRepo.createReport(reportData);
    return await this.getReportById(reportId);
  }

  async reviewReport(
    id: string,
    status: string,
    feedback: string,
    reviewedBy: string
  ) {
    if (!["Approved", "Rejected"].includes(status)) {
      throw new Error("Trạng thái không hợp lệ");
    }

    await this.reportRepo.reviewReport(id, status, feedback, reviewedBy);
    return await this.getReportById(id);
  }

  async deleteReport(id: string) {
    await this.reportRepo.deleteReport(id);
  }
}
