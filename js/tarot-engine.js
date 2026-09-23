(function (global) {
  "use strict";

  const THEME_LABELS = Object.freeze({
    love: "恋愛",
    work: "仕事",
    relationships: "人間関係"
  });

  const SPREADS = Object.freeze({
    one: Object.freeze({
      label: "1枚引き",
      count: 1,
      positions: Object.freeze(["今のあなたへ"])
    }),
    three: Object.freeze({
      label: "3枚引き",
      count: 3,
      positions: Object.freeze(["過去", "現在", "未来"])
    })
  });

  function randomInteger(max) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new RangeError("maxには1以上の整数が必要です。");
    }

    const cryptoObject = global.crypto;

    if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
      const limit = Math.floor(0x100000000 / max) * max;
      const buffer = new Uint32Array(1);
      let value;

      do {
        cryptoObject.getRandomValues(buffer);
        value = buffer[0];
      } while (value >= limit);

      return value % max;
    }

    return Math.floor(Math.random() * max);
  }

  function shuffle(cards, randomIntegerFunction = randomInteger) {
    const shuffled = cards.slice();

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIntegerFunction(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  }

  function validateCards(cards) {
    const errors = [];

    if (!Array.isArray(cards)) {
      return { valid: false, errors: ["カードデータが配列ではありません。"] };
    }

    if (cards.length !== 22) {
      errors.push(`カードは22枚必要ですが、${cards.length}枚です。`);
    }

    const ids = new Set();

    cards.forEach((card, index) => {
      const location = `${index + 1}番目のカード`;

      if (!card || typeof card !== "object") {
        errors.push(`${location}が正しい形式ではありません。`);
        return;
      }

      ["id", "number", "name", "english", "symbol"].forEach((field) => {
        if (typeof card[field] !== "string" || card[field].trim() === "") {
          errors.push(`${location}の${field}がありません。`);
        }
      });

      if (ids.has(card.id)) {
        errors.push(`カードID「${card.id}」が重複しています。`);
      }
      ids.add(card.id);

      ["upright", "reversed"].forEach((orientation) => {
        const meaning = card[orientation];
        const meaningLocation = `${card.name || location}の${orientation}`;

        if (!meaning || typeof meaning !== "object") {
          errors.push(`${meaningLocation}の解釈がありません。`);
          return;
        }

        if (!Array.isArray(meaning.keywords) || meaning.keywords.length === 0) {
          errors.push(`${meaningLocation}のキーワードがありません。`);
        }

        ["general", "advice"].forEach((field) => {
          if (typeof meaning[field] !== "string" || meaning[field].trim() === "") {
            errors.push(`${meaningLocation}の${field}がありません。`);
          }
        });

        Object.keys(THEME_LABELS).forEach((theme) => {
          if (!meaning.themes || typeof meaning.themes[theme] !== "string" || meaning.themes[theme].trim() === "") {
            errors.push(`${meaningLocation}のテーマ「${theme}」がありません。`);
          }
        });
      });
    });

    return { valid: errors.length === 0, errors };
  }

  function drawCards(count, cards = global.TAROT_CARDS, randomIntegerFunction = randomInteger) {
    if (!Number.isInteger(count) || count < 1 || count > cards.length) {
      throw new RangeError("引く枚数が正しくありません。");
    }

    return shuffle(cards, randomIntegerFunction)
      .slice(0, count)
      .map((card) => {
        const orientation = randomIntegerFunction(2) === 0 ? "upright" : "reversed";

        return {
          card,
          orientation,
          orientationLabel: orientation === "upright" ? "正位置" : "逆位置",
          meaning: card[orientation]
        };
      });
  }

  function hashString(value) {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function drawDailyCard(dateKey, cards = global.TAROT_CARDS) {
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new TypeError("dateKeyはYYYY-MM-DD形式で指定してください。");
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      throw new RangeError("カードがありません。");
    }

    const card = cards[hashString(`card:${dateKey}`) % cards.length];
    const orientation = hashString(`orientation:${dateKey}`) % 2 === 0 ? "upright" : "reversed";

    return {
      card,
      orientation,
      orientationLabel: orientation === "upright" ? "正位置" : "逆位置",
      meaning: card[orientation]
    };
  }

  function getThemeLabel(theme) {
    return THEME_LABELS[theme] || "選択したテーマ";
  }

  function getSpread(spread) {
    return SPREADS[spread] || SPREADS.one;
  }

  global.TarotEngine = Object.freeze({
    THEME_LABELS,
    SPREADS,
    randomInteger,
    shuffle,
    validateCards,
    drawCards,
    drawDailyCard,
    getThemeLabel,
    getSpread
  });
})(typeof window !== "undefined" ? window : globalThis);
