"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require(path.join(__dirname, "..", "js", "tarot-data.js"));
require(path.join(__dirname, "..", "js", "tarot-engine.js"));

const cards = globalThis.TAROT_CARDS;
const engine = globalThis.TarotEngine;
const projectRoot = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

assert.ok(engine, "抽選処理を読み込めませんでした。");
assert.equal(cards.length, 22, "カードは22枚必要です。");
assert.equal(new Set(cards.map((card) => card.id)).size, 22, "カードIDが重複しています。");

const htmlIds = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, "HTML内のidが重複しています。");

const localReferences = Array.from(html.matchAll(/\s(?:src|href)="([^"]+)"/g), (match) => match[1])
  .filter((reference) => !reference.startsWith("#") && !/^https?:/i.test(reference));

localReferences.forEach((reference) => {
  assert.equal(fs.existsSync(path.join(projectRoot, reference)), true, `参照ファイルがありません: ${reference}`);
});

const externalSources = Array.from(html.matchAll(/\ssrc="(https?:[^"]+)"/gi), (match) => match[1]);
assert.equal(externalSources.length, 0, `外部ファイルを読み込んでいます: ${externalSources.join(", ")}`);

const validation = engine.validateCards(cards);
assert.equal(validation.valid, true, validation.errors.join("\n"));

const dailyDraw = engine.drawDailyCard("2026-09-23", cards);
const repeatedDailyDraw = engine.drawDailyCard("2026-09-23", cards);
assert.equal(dailyDraw.card.id, repeatedDailyDraw.card.id, "同じ日のカードが一致しません。");
assert.equal(dailyDraw.orientation, repeatedDailyDraw.orientation, "同じ日のカードの向きが一致しません。");
assert.ok(["upright", "reversed"].includes(dailyDraw.orientation), "今日の1枚の向きが不正です。");
assert.throws(() => engine.drawDailyCard("2026/09/23", cards), TypeError, "不正な日付形式を拒否できていません。");

assert.ok(html.includes('id="daily-reading-button"'), "今日の1枚ボタンがありません。");
assert.ok(html.includes('id="share-result-button"'), "結果共有ボタンがありません。");
assert.ok(html.includes('id="share-fallback-text"'), "手動共有欄がありません。");

const originalOrder = cards.map((card) => card.id).join(",");
const seenOrientations = new Set();

for (let attempt = 0; attempt < 300; attempt += 1) {
  const draws = engine.drawCards(3, cards);
  const drawnIds = draws.map((draw) => draw.card.id);

  assert.equal(draws.length, 3, "3枚引きの枚数が正しくありません。");
  assert.equal(new Set(drawnIds).size, 3, "3枚引きでカードが重複しました。");
  draws.forEach((draw) => seenOrientations.add(draw.orientation));
}

assert.equal(cards.map((card) => card.id).join(","), originalOrder, "抽選によって元データの順序が変わりました。");
assert.ok(seenOrientations.has("upright"), "正位置が抽選されませんでした。");
assert.ok(seenOrientations.has("reversed"), "逆位置が抽選されませんでした。");

Object.keys(engine.THEME_LABELS).forEach((theme) => {
  cards.forEach((card) => {
    assert.ok(card.upright.themes[theme], `${card.name}・正位置の${theme}がありません。`);
    assert.ok(card.reversed.themes[theme], `${card.name}・逆位置の${theme}がありません。`);
  });
});

cards.filter((card) => card.image).forEach((card) => {
  assert.equal(
    fs.existsSync(path.join(projectRoot, card.image)),
    true,
    `${card.name}の画像がありません: ${card.image}`
  );
});

assert.equal(cards.filter((card) => card.image).length, 22, "正式画像が設定されていないカードがあります。");
assert.equal(
  fs.existsSync(path.join(projectRoot, "assets", "cards", "card-back.webp")),
  true,
  "カード裏面の画像がありません。"
);

assert.throws(() => engine.drawCards(0, cards), RangeError, "0枚の抽選を拒否できていません。");
assert.throws(() => engine.drawCards(23, cards), RangeError, "カード枚数を超える抽選を拒否できていません。");

console.log("すべてのテストに合格しました。");
