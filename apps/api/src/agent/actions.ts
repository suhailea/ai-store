// Executes an approved action exactly once (idempotency enforced via DB).

import { eq } from "drizzle-orm";
import { getDb, approvals, tasks } from "@staffroom/db";
import logger from "../lib/logger";
import { executeGrantedMcpTool } from "./mcp/employee-tools";
import { executeNativeTool } from "./tools/index";
import { z } from "zod";

const toolPayloadSchema = z.object({
  provider: z.string(), toolName: z.string(), arguments: z.record(z.unknown()).default({}),
});

export async function executeApprovedAction(params: {
  approvalId: string;
  idempotencyKey: string;
  actionType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();

  // DB-backed idempotency: if executedAt is already set, skip
  const [existing] = await db
    .select({ executedAt: approvals.executedAt, employeeId: approvals.employeeId,
      businessId: tasks.businessId, payload: approvals.payloadJson })
    .from(approvals)
    .innerJoin(tasks, eq(approvals.taskId, tasks.id))
    .where(eq(approvals.idempotencyKey, params.idempotencyKey))
    .limit(1);

  if (existing?.executedAt) {
    return;
  }

  switch (params.actionType) {
    case "native_tool": {
      if (!existing) throw new Error("Approval not found.");
      const original = toolPayloadSchema.parse(existing.payload);
      const edited = toolPayloadSchema.parse(params.payload);
      if (edited.provider !== original.provider || edited.toolName !== original.toolName) {
        throw new Error("An approval's tool cannot be changed. Edit its arguments only.");
      }
      await executeNativeTool(edited.provider, edited.toolName, edited.arguments, {
        businessId: existing.businessId, employeeId: existing.employeeId,
      });
      break;
    }
    case "mcp_tool": {
      if (!existing) throw new Error("Approval not found.");
      const original = toolPayloadSchema.parse(existing.payload);
      const edited = toolPayloadSchema.parse(params.payload);
      if (edited.provider !== original.provider || edited.toolName !== original.toolName) {
        throw new Error("An approval's tool cannot be changed. Edit its arguments only.");
      }
      await executeGrantedMcpTool(
        { provider: original.provider, toolName: original.toolName },
        edited.arguments,
        { employeeId: existing.employeeId, businessId: existing.businessId },
        true
      );
      break;
    }
    default:
      logger.info(`Action approved: ${params.actionType}`, { approvalId: params.approvalId, payload: params.payload });
  }
}
