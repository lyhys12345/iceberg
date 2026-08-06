import assert from "node:assert/strict";
import { pickProvider } from "../src/ai-provider.mjs";

assert.equal(pickProvider({ AI_PROVIDER: "gemini" }), "gemini");
assert.equal(pickProvider({ AI_PROVIDER: "openai" }), "openai");
assert.equal(pickProvider({ AI_PROVIDER: "local", GEMINI_API_KEY: "x" }), "local");
assert.equal(pickProvider({ GEMINI_API_KEY: "x" }), "gemini");
assert.equal(pickProvider({ OPENAI_API_KEY: "x" }), "openai");
assert.equal(pickProvider({}), "local");

console.log("ai-provider tests passed");
