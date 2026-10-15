import Anthropic from "@anthropic-ai/sdk";
export async function callAnthropic(req) {
    const client = new Anthropic({
        apiKey: req.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    // Convert our unified messages to Anthropic format
    const messages = req.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string"
            ? m.content
            : m.content,
    }));
    // Convert tools if present
    const tools = req.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
    }));
    const systemParam = req.cacheSystemPrompt
        ? [
            { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
            ...(req.systemDynamic ? [{ type: "text", text: req.systemDynamic }] : []),
        ]
        : [
            { type: "text", text: req.system + (req.systemDynamic ? `\n\n${req.systemDynamic}` : "") },
        ];
    const response = await client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        system: systemParam,
        messages,
        ...(tools && tools.length > 0 ? { tools } : {}),
    });
    // Map back to unified format
    const content = response.content.map((block) => {
        if (block.type === "text") {
            return { type: "text", text: block.text };
        }
        // tool_use
        return {
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: block.input,
        };
    });
    const stopReason = response.stop_reason === "tool_use"
        ? "tool_use"
        : response.stop_reason === "max_tokens"
            ? "max_tokens"
            : "end_turn";
    return {
        content,
        stopReason,
        usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        },
    };
}
