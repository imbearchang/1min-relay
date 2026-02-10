import { Hono } from "hono";
import { HonoEnv } from "../types/hono";
import { ChatHandler } from "../handlers";
import { authMiddleware } from "../middleware/auth";
import { createRateLimitMiddleware } from "../middleware/rate-limit-hono";
import { calculateTokens, extractAllMessageText } from "../utils";
import { ValidationError } from "../utils/errors";
import { ChatCompletionRequest } from "../types";

const app = new Hono<HonoEnv>();

app.post("/completions", authMiddleware, async (c) => {
  let body: ChatCompletionRequest;
  try {
    body = await c.req.json();
  } catch (error) {
    throw new ValidationError("Invalid JSON in request body");
  }

  const apiKey = c.get("apiKey");

  // Calculate tokens for rate limiting
  const messageText = extractAllMessageText(body.messages ?? []);
  const tokenCount = calculateTokens(messageText, body.model);

  // Apply rate limiting with token count
  const rateLimitMiddleware = createRateLimitMiddleware(tokenCount);
  await rateLimitMiddleware(c, async () => {});

  const chatHandler = new ChatHandler(c.env);
  const response = await chatHandler.handleChatCompletionsWithBody(
    body,
    apiKey,
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});

export default app;
