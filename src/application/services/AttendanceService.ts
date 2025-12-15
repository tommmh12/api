import { AttendanceRepository } from "../../infrastructure/repositories/AttendanceRepository.js";
import { DepartmentRepository } from "../../infrastructure/repositories/DepartmentRepository.js";

export class AttendanceService {
  constructor(
    private attendanceRepository: AttendanceRepository,
    private departmentRepository: DepartmentRepository
  ) {}

  /**
   * Get attendance records for manager's department
   */
  async getDepartmentAttendance(
    userId: string,
    view: string = "daily",
    date?: string,
    startDate?: string,
    endDate?: string
  ) {
    try {
      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      let attendance;

      if (view === "daily" && date) {
        attendance =
          await this.attendanceRepository.getDepartmentAttendanceByDate(
            department.id,
            date
          );
      } else if (view === "monthly" && startDate && endDate) {
        attendance =
          await this.attendanceRepository.getDepartmentAttendanceByRange(
            department.id,
            startDate,
            endDate
          );
      } else {
        // Default to today
        const today = new Date().toISOString().split("T")[0];
        attendance =
          await this.attendanceRepository.getDepartmentAttendanceByDate(
            department.id,
            today
          );
      }

      // Calculate statistics
      const stats: any = {
        present: attendance.filter((a: any) => a.status === "present").length,
        absent: attendance.filter((a: any) => a.status === "absent").length,
        late: attendance.filter((a: any) => a.status === "late").length,
        early_leave: attendance.filter((a: any) => a.status === "early_leave")
          .length,
        on_leave: attendance.filter((a: any) => a.status === "on_leave").length,
        total: attendance.length,
        rate: 0,
      };

      stats.rate =
        attendance.length > 0
          ? Math.round((stats.present / attendance.length) * 100)
          : 0;

      return {
        view,
        date: date || new Date().toISOString().split("T")[0],
        startDate,
        endDate,
        stats,
        records: attendance.map((record: any) => ({
          id: record.id,
          employee_id: record.employee_id,
          employee_name: record.employee_name,
          date: record.date,
          check_in: record.check_in,
          check_out: record.check_out,
          status: record.status,
          duration: record.duration,
        })),
      };
    } catch (error) {
      console.error("Error getting department attendance:", error);
      throw error;
    }
  }

  /**
   * Record attendance check-in for employee
   */
  async checkInEmployee(
    userId: string,
    employeeId: string,
    checkInTime?: string
  ) {
    try {
      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      // Verify employee is in the manager's department
      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );
      const isValidEmployee = employees.some((emp) => emp.id === employeeId);

      if (!isValidEmployee) {
        throw new Error("Employee not found in your department");
      }

      const today = new Date().toISOString().split("T")[0];
      const check_in = checkInTime || new Date().toISOString();

      // Check if already checked in today
      const existingRecord =
        await this.attendanceRepository.findByEmployeeAndDate(
          employeeId,
          today
        );

      if (existingRecord && existingRecord.check_in) {
        throw new Error("Employee already checked in today");
      }

      if (existingRecord) {
        // Update existing record
        await this.attendanceRepository.update(existingRecord.id, { check_in });
      } else {
        // Create new record
        await this.attendanceRepository.create({
          employee_id: employeeId,
          date: today,
          check_in,
        });
      }

      return {
        employeeId,
        checkInTime: check_in,
        message: "Check-in recorded successfully",
      };
    } catch (error) {
      console.error("Error checking in employee:", error);
      throw error;
    }
  }

  /**
   * Record attendance check-out for employee
   */
  async checkOutEmployee(
    userId: string,
    employeeId: string,
    checkOutTime?: string
  ) {
    try {
      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      // Verify employee is in the manager's department
      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );
      const isValidEmployee = employees.some((emp) => emp.id === employeeId);

      if (!isValidEmployee) {
        throw new Error("Employee not found in your department");
      }

      const today = new Date().toISOString().split("T")[0];
      const check_out = checkOutTime || new Date().toISOString();

      // Find today's attendance record
      const record = await this.attendanceRepository.findByEmployeeAndDate(
        employeeId,
        today
      );

      if (!record) {
        throw new Error("No check-in record found for today");
      }

      if (record.check_out) {
        throw new Error("Employee already checked out today");
      }

      // Calculate duration
      if (record.check_in) {
        const checkInTime = new Date(record.check_in).getTime();
        const checkOutTime = new Date(check_out).getTime();
        const durationMs = checkOutTime - checkInTime;
        const durationHours =
          Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

        // Update record
        await this.attendanceRepository.update(record.id, {
          check_out,
          duration: durationHours,
          status: durationHours >= 8 ? "present" : "early_leave",
        });
      }

      return {
        employeeId,
        checkOutTime: check_out,
        message: "Check-out recorded successfully",
      };
    } catch (error) {
      console.error("Error checking out employee:", error);
      throw error;
    }
  }

  /**
   * Mark employee attendance manually
   */
  async markAttendance(
    userId: string,
    employeeId: string,
    date: string,
    status: "present" | "absent" | "late" | "early_leave" | "on_leave"
  ) {
    try {
      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      // Verify employee is in the manager's department
      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );
      const isValidEmployee = employees.some((emp) => emp.id === employeeId);

      if (!isValidEmployee) {
        throw new Error("Employee not found in your department");
      }

      // Find or create attendance record
      const existingRecord =
        await this.attendanceRepository.findByEmployeeAndDate(employeeId, date);

      if (existingRecord) {
        await this.attendanceRepository.update(existingRecord.id, { status });
      } else {
        await this.attendanceRepository.create({
          employee_id: employeeId,
          date,
          status,
        });
      }

      return {
        employeeId,
        date,
        status,
        message: "Attendance marked successfully",
      };
    } catch (error) {
      console.error("Error marking attendance:", error);
      throw error;
    }
  }

  /**
   * Get attendance statistics for department
   */
  async getDepartmentAttendanceStats(userId: string, month?: string) {
    try {
      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      // Default to current month
      const now = new Date();
      const targetMonth =
        month ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [year, monthStr] = targetMonth.split("-");
      const startDate = `${year}-${monthStr}-01`;
      const endDate = new Date(parseInt(year), parseInt(monthStr), 0)
        .toISOString()
        .split("T")[0];

      // Get attendance records for the month
      const attendance =
        await this.attendanceRepository.getDepartmentAttendanceByRange(
          department.id,
          startDate,
          endDate
        );

      // Get employees
      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );

      // Calculate stats by employee
      const statsByEmployee = employees.map((emp: any) => {
        const empAttendance = attendance.filter(
          (a: any) => a.employee_id === emp.id
        );
        const present = empAttendance.filter(
          (a: any) => a.status === "present"
        ).length;
        const absent = empAttendance.filter(
          (a: any) => a.status === "absent"
        ).length;
        const late = empAttendance.filter(
          (a: any) => a.status === "late"
        ).length;
        const onLeave = empAttendance.filter(
          (a: any) => a.status === "on_leave"
        ).length;

        return {
          employeeId: emp.id,
          employeeName: emp.full_name,
          present,
          absent,
          late,
          on_leave: onLeave,
          total: empAttendance.length,
          rate:
            empAttendance.length > 0
              ? Math.round((present / empAttendance.length) * 100)
              : 0,
        };
      });

      // Calculate overall stats
      const totalPresent = attendance.filter(
        (a: any) => a.status === "present"
      ).length;
      const totalAbsent = attendance.filter(
        (a: any) => a.status === "absent"
      ).length;
      const totalLate = attendance.filter(
        (a: any) => a.status === "late"
      ).length;
      const totalOnLeave = attendance.filter(
        (a: any) => a.status === "on_leave"
      ).length;

      return {
        month: targetMonth,
        summary: {
          present: totalPresent,
          absent: totalAbsent,
          late: totalLate,
          on_leave: totalOnLeave,
          total: attendance.length,
          rate:
            attendance.length > 0
              ? Math.round((totalPresent / attendance.length) * 100)
              : 0,
        },
        byEmployee: statsByEmployee,
      };
    } catch (error) {
      console.error("Error getting attendance statistics:", error);
      throw error;
    }
  }
}
