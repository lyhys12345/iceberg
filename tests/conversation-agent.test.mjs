import assert from "node:assert/strict";
import { beginnerIntro, beginnerMissingFields, beginnerQuestion, classifyBeginnerIntent, parseBeginnerTradeMessage } from "../src/conversation-agent.mjs";

const english = parseBeginnerTradeMessage("I want to buy NVDA. My account is $25000 and I plan to buy $1000. Current price is $120.");
assert.equal(english.symbol, "NVDA");
assert.equal(english.accountValue, "25000");
assert.equal(english.plannedBudget, "1000");
assert.equal(english.currentPrice, "120");
assert.deepEqual(beginnerMissingFields(english), []);

const lowercaseTicker = parseBeginnerTradeMessage("nvda");
assert.equal(lowercaseTicker.symbol, "NVDA");

const lowercaseContextTicker = parseBeginnerTradeMessage("I want to buy nvda with $1000. Current price is $120.", {
  accountValue: "25000",
});
assert.equal(lowercaseContextTicker.symbol, "NVDA");

assert.equal(classifyBeginnerIntent("hi who are you"), "identity");
assert.equal(classifyBeginnerIntent("how do I use this?"), "help");
assert.equal(classifyBeginnerIntent("hello"), "greeting");
assert.equal(classifyBeginnerIntent("I want to buy NVDA with $1000"), "trade");
assert.match(beginnerIntro("identity"), /pre-trade risk layer/);

const chinese = parseBeginnerTradeMessage("我想买 TSLA，账户 2 万，准备买 3000 美元，现在股价 250。");
assert.equal(chinese.symbol, "TSLA");
assert.equal(chinese.accountValue, "20000");
assert.equal(chinese.plannedBudget, "3000");
assert.equal(chinese.currentPrice, "250");
assert.deepEqual(beginnerMissingFields(chinese), []);

const missing = parseBeginnerTradeMessage("Thinking about buying AAPL with 1000 dollars.");
assert.ok(beginnerMissingFields(missing).includes("account value"));
assert.ok(beginnerMissingFields(missing).includes("current price"));

const withBudget = parseBeginnerTradeMessage("I want to buy NVDA with $1000. Current price is $120.", {
  accountValue: "25000",
});
assert.equal(withBudget.plannedBudget, "1000");
assert.equal(withBudget.currentPrice, "120");

const longHorizon = parseBeginnerTradeMessage("I want to buy NVDA for 5 years. Current price is $120.", {
  accountValue: "25000",
});
assert.equal(longHorizon.plannedBudget, "");

const vague = parseBeginnerTradeMessage("I want to buy DRAM ETF, is now a good time to trade?");
assert.deepEqual(beginnerMissingFields(vague), ["account value", "planned amount", "current price"]);

const searchFailedQuestion = beginnerQuestion(["account value", "planned amount", "current price"], {
  marketSearchFailed: true,
  symbol: "DRAM",
});
assert.match(searchFailedQuestion, /I still need your account size, how much you plan to buy/);
assert.match(searchFailedQuestion, /already tried to resolve DRAM/);

console.log("conversation-agent tests passed");
