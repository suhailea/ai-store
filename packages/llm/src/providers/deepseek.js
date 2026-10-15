/**
 * DeepSeek provider — uses the DeepSeek cloud API.
 * DeepSeek's API is OpenAI-compatible, so we use the openai SDK pointed at
 * https://api.deepseek.com
 */
import OpenAI from "openai";
export async function callDeepSeek(req) {
    const client = new OpenAI({
        apiKey: req.apiKey ?? process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
    });
    // Build OpenAI-compatible messages — combine static + dynamic system parts
    const systemContent = req.system + (req.systemDynamic ? `\n\n${req.systemDynamic}` : "");
    const messages = [
        { role: "system", content: systemContent },
        ...req.messages.map((m) => {
            if (typeof m.content === "string") {
                return { role: m.role, content: m.content };
            }
            // Handle structured content (tool results etc.)
            const parts = m.content;
            const textParts = parts.filter((p) => p.type === "text");
            const toolResultParts = parts.filter((p) => p.type === "tool_result");
            if (toolResultParts.length > 0) {
                // Tool results become a series of tool messages
                return toolResultParts.map((p) => ({
                    role: "tool",
                    tool_call_id: p.tool_use_id,
                    content: p.content,
                }));
            }
            return {
                role: m.role,
                content: textParts.map((p) => p.text).join("\n"),
            };
        }).flat(),
    ];
    // Convert tools to OpenAI function-calling format
    const tools = req.tools?.map((t) => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
        },
    }));
    const response = await client.chat.completions.create({
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        messages,
        ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
    });
    const choice = response.choices[0];
    const msg = choice.message;
    const content = [];
    if (msg.content) {
        content.push({ type: "text", text: msg.content });
    }
    for (const toolCall of msg.tool_calls ?? []) {
        content.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments || "{}"),
        });
    }
    const stopReason = choice.finish_reason === "tool_calls"
        ? "tool_use"
        : choice.finish_reason === "length"
            ? "max_tokens"
            : "end_turn";
    return {
        content,
        stopReason,
        usage: {
            inputTokens: response.usage?.prompt_tokens ?? 0,
            outputTokens: response.usage?.completion_tokens ?? 0,
        },
    };
}
