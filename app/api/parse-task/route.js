import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text?.trim()) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract task information from this text and return ONLY a JSON object with no markdown, no backticks, no explanation. Just the raw JSON.

Text: "${text}"

Return this exact structure:
{
  "title": "concise task title",
  "type": "task or project",
  "priority": "high, medium, or low",
  "due_date": "YYYY-MM-DD or null",
  "notes": "any additional context or null"
}

Rules:
- title should be concise and action-oriented, max 60 characters
- type: always return "task" unless the user explicitly uses the word "project" to describe a multi-step initiative they want to track as a container. A task that mentions a project name is still a "task"
- priority: "high" if blocking/urgent/critical, "low" if someday/eventually, otherwise "medium"
- due_date: convert relative dates to actual YYYY-MM-DD dates. Today is ${new Date().toISOString().split("T")[0]} which is a Tuesday. "EOD Friday" or "by Friday" means the upcoming Friday. "tomorrow" means the next calendar day. "next week" means 7 days from today. Never return today's date unless the text explicitly says "today" or "EOD today".
- notes: capture any context that didn't fit in the title`,
        },
      ],
    });

    const raw = message.content[0].text.trim();
    const parsed = JSON.parse(raw);

    return Response.json(parsed);
  } catch (error) {
    console.error("Parse error:", error);
    return Response.json({ error: "Failed to parse task" }, { status: 500 });
  }
}