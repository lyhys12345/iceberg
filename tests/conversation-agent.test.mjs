import assert from "node:assert/strict";
import { beginnerMissingFields, beginnerQuestion, parseBeginnerTradeMessage } from "../src/conversation-agent.mjs";

const english = parseBeginnerTradeMessage("I want to buy NVDA. My account is $25000 and I plan to buy $1000. Current price is $120.");
assert.equal(english.symbol, "NVDA");
assert.equal(english.accountValue, "25000");
assert.equal(english.plannedBudget, "1000");
assert.equal(english.currentPrice, "120");
assert.deepEqual(beginnerMissingFields(english), []);

const chinese = parseBeginnerTradeMessage("我想买 TSLA，账户 2 万，准备买 3000 美元，现在股价 250。");
assert.equal(chinese.symbol, "TSLA");
assert.equal(chinese.accountValue, "20000");
assert.equal(chinese.plannedBudget, "3000");
assert.equal(chinese.currentPrice, "250");
assert.deepEqual(beginnerMissingFields(chinese), []);

const missing = parseBeginnerTradeMessage("Thinking about buying AAPL with 1000 dollars.");
assert.ok(beginnerMissingFields(missing).includes("account value"));
assert.ok(beginnerMissingFields(missing).includes("current price"));

const vague = parseBeginnerTradeMessage("I want to buy DRAM ETF, is now a good time to trade?");
assert.deepEqual(beginnerMissingFields(vague), ["account value", "planned amount", "current price"]);

const searchFailedQuestion = beginnerQuestion(["account value", "planned amount", "current price"], {
  marketSearchFailed: true,
  symbol: "DRAM",
});
assert.match(searchFailedQuestion, /I still need your account size, how much you plan to buy/);
assert.match(searchFailedQuestion, /already tried to resolve DRAM/);

console.log("conversation-agent tests passed");
