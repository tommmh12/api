import { Request, Response } from "express";
import { ActivityLogRepository } from "../../infrastructure/repositories/ActivityLogRepository.js";

const activityLogRepository = new ActivityLogRepository();

export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      userId,
      search,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const result = await activityLogRepository.findAllWithFilters({
      limit: limitNum,
      offset,
      type: type as string,
      userId: userId as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error getting activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy nhật ký hoạt động",
    });
  }
};

export const getActivityLogById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const log = await activityLogRepository.findById(id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhật ký",
      });
    }

    res.json({ success: true, data: log });
  } catch (error) {
    console.error("Error getting activity log:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy chi tiết nhật ký",
    });
  }
};

export const getActivityStats = async (req: Request, res: Response) => {
  try {
    const stats = await activityLogRepository.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error getting activity stats:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy thống kê",
    });
  }
};

export const getActivityTypes = async (req: Request, res: Response) => {
  try {
    const types = await activityLogRepository.getActivityTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    console.error("Error getting activity types:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách loại hoạt động",
    });
  }
};

export const deleteActivityLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await activityLogRepository.delete(id);
    res.json({ success: true, message: "Đã xóa nhật ký" });
  } catch (error) {
    console.error("Error deleting activity log:", error);
    res.status(500).json({
      success: false,
      message: "Không thể xóa nhật ký",
    });
  }
};

export const deleteMultipleActivityLogs = async (
  req: Request,
  res: Response
) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: "Danh sách ID không hợp lệ",
      });
    }

    await activityLogRepository.deleteMultiple(ids);
    res.json({ success: true, message: `Đã xóa ${ids.length} nhật ký` });
  } catch (error) {
    console.error("Error deleting activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Không thể xóa nhật ký",
    });
  }
};

export const exportActivityLogs = async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, format = "csv" } = req.query;

    const result = await activityLogRepository.findAllWithFilters({
      limit: 10000,
      offset: 0,
      type: type as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    if (format === "csv") {
      const csv = generateCSV(result.logs);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=activity_logs_${Date.now()}.csv`
      );
      res.send("\uFEFF" + csv); // BOM for Excel UTF-8
    } else {
      res.json({ success: true, data: result.logs });
    }
  } catch (error) {
    console.error("Error exporting activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Không thể xuất dữ liệu",
    });
  }
};

function generateCSV(logs: any[]): string {
  const headers = [
    "ID",
    "Thời gian",
    "Người thực hiện",
    "Loại hành động",
    "Nội dung",
    "Đối tượng",
    "IP Address",
    "User Agent",
  ];

  const rows = logs.map((log) => [
    log.id,
    new Date(log.created_at).toLocaleString("vi-VN"),
    log.user_name || "Hệ thống",
    log.type,
    `"${(log.content || "").replace(/"/g, '""')}"`,
    log.target || "",
    log.ip_address || "",
    `"${((log.meta?.userAgent as string) || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
