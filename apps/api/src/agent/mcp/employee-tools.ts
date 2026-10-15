import { and, eq, isNull } from "drizzle-orm";
import { connectorTools, employeeToolGrants, getDb } from "@staffroom/db";
import type { EmployeeToolBinding } from "../tools";
import { getConnectorToken } from "./auth";
import { callMcpTool, isMcpToolReadOnly } from "./client";
import { isDiscoverableProvider, MCP_REGISTRY } from "./registry";
import { guardOutput } from "../guardrails";

export async function executeGrantedMcpTool(
  binding: EmployeeToolBinding,
  args: Record<string, unknown>,
  scope: { employeeId: string; businessId: string },
  approved = false
): Promise<{ requiresApproval: true } | { requiresApproval: false; result: unknown }> {
  if (!isDiscoverableProvider(binding.provider)) throw new Error("Tool provider is not supported.");
  // Revalidate the exact provider + name, including revocations made mid-run.
  const [grant] = await getDb().select({ id: employeeToolGrants.id })
    .from(employeeToolGrants)
    .innerJoin(connectorTools, and(
      eq(employeeToolGrants.businessId, connectorTools.businessId),
      eq(employeeToolGrants.provider, connectorTools.provider),
      eq(employeeToolGrants.toolName, connectorTools.toolName)
    ))
    .where(and(
      eq(employeeToolGrants.employeeId, scope.employeeId),
      eq(employeeToolGrants.businessId, scope.businessId),
      eq(employeeToolGrants.provider, binding.provider),
      eq(employeeToolGrants.toolName, binding.toolName),
      isNull(employeeToolGrants.revokedAt)
    )).limit(1);
  if (!grant) throw new Error(`Permission denied: no active grant for ${binding.provider}/${binding.toolName}.`);

  const { accessToken } = await getConnectorToken(scope.businessId, binding.provider);
  if (!approved && !await isMcpToolReadOnly(binding.provider, accessToken, binding.toolName)) {
    return { requiresApproval: true };
  }
  const raw = await callMcpTool({
    serverUrl: MCP_REGISTRY[binding.provider], accessToken,
    toolName: binding.toolName, toolArgs: args,
  });

  const guarded = await guardOutput(raw, {
    source: `${binding.provider}/${binding.toolName}`,
    businessId: scope.businessId,
  });

  if (guarded.blocked) {
    return { requiresApproval: false, result: { blocked: true, reason: guarded.reason } };
  }

  return { requiresApproval: false, result: guarded.content };
}
