import { WorkflowRepository } from "../../infrastructure/repositories/WorkflowRepository.js";

export class WorkflowService {
  private workflowRepo = new WorkflowRepository();

  async getAllWorkflows() {
    const workflows = await this.workflowRepo.getAllWorkflows();

    // Get statuses for each workflow
    for (const workflow of workflows) {
      workflow.statuses = await this.workflowRepo.getWorkflowStatuses(
        workflow.id
      );
    }

    return workflows;
  }

  async getWorkflowById(id: string) {
    const workflow = await this.workflowRepo.getWorkflowById(id);
    if (!workflow) {
      throw new Error("Không tìm thấy quy trình");
    }

    workflow.statuses = await this.workflowRepo.getWorkflowStatuses(id);
    return workflow;
  }

  async createWorkflow(workflowData: any, userId?: string) {
    if (!workflowData.name) {
      throw new Error("Thiếu tên quy trình");
    }

    const workflowId = await this.workflowRepo.createWorkflow(
      workflowData,
      userId
    );

    // Create default statuses if provided
    if (workflowData.statuses && workflowData.statuses.length > 0) {
      for (let i = 0; i < workflowData.statuses.length; i++) {
        await this.workflowRepo.createWorkflowStatus(workflowId, {
          ...workflowData.statuses[i],
          order: i,
        });
      }
    }

    return await this.getWorkflowById(workflowId);
  }

  async updateWorkflow(id: string, workflowData: any) {
    await this.workflowRepo.updateWorkflow(id, workflowData);

    // Update statuses if provided
    if (workflowData.statuses !== undefined) {
      // Delete all existing statuses and recreate
      await this.workflowRepo.deleteWorkflowStatuses(id);

      for (let i = 0; i < workflowData.statuses.length; i++) {
        await this.workflowRepo.createWorkflowStatus(id, {
          ...workflowData.statuses[i],
          order: i,
        });
      }
    }

    return await this.getWorkflowById(id);
  }

  async deleteWorkflow(id: string) {
    await this.workflowRepo.deleteWorkflow(id);
  }
}
