(function (global) {
  "use strict";

  const state = {
    mode: "regular",
    theme: "love",
    spread: "one",
    draws: [],
    revealed: new Set(),
    dailyDateKey: "",
    dailyDateLabel: ""
  };

  const elements = {};

  function initialize() {
    Object.assign(elements, {
      selectionPanel: document.querySelector("#selection-panel"),
      resultPanel: document.querySelector("#result-panel"),
      form: document.querySelector("#reading-form"),
      formError: document.querySelector("#form-error"),
      dailyDate: document.querySelector("#daily-date"),
      dailyReadingButton: document.querySelector("#daily-reading-button"),
      resultTitle: document.querySelector("#result-title"),
      resultContext: document.querySelector("#result-context"),
      revealGuide: document.querySelector("#reveal-guide"),
      cardsContainer: document.querySelector("#cards-container"),
      revealAllButton: document.querySelector("#reveal-all-button"),
      closingMessage: document.querySelector("#closing-message"),
      closingText: document.querySelector("#closing-text"),
      shareResultButton: document.querySelector("#share-result-button"),
      shareStatus: document.querySelector("#share-status"),
      shareFallback: document.querySelector("#share-fallback"),
      shareFallbackText: document.querySelector("#share-fallback-text"),
      drawAgainButton: document.querySelector("#draw-again-button"),
      changeOptionsButton: document.querySelector("#change-options-button"),
      cardTemplate: document.querySelector("#card-template")
    });

    if (!global.TarotEngine || !global.TAROT_CARDS) {
      showFatalError("必要なデータを読み込めませんでした。ファイル一式が同じフォルダ構成にあるか確認してください。");
      return;
    }

    const validation = global.TarotEngine.validateCards(global.TAROT_CARDS);

    if (!validation.valid) {
      console.error("カードデータの確認エラー:", validation.errors);
      showFatalError("カードデータに不足があります。READMEの案内を確認してください。");
      return;
    }

    const today = getLocalDateInfo();
    elements.dailyDate.dateTime = today.key;
    elements.dailyDate.textContent = today.label;

    elements.form.addEventListener("submit", handleSubmit);
    elements.dailyReadingButton.addEventListener("click", startDailyReading);
    elements.revealAllButton.addEventListener("click", revealAllCards);
    elements.shareResultButton.addEventListener("click", handleShare);
    elements.drawAgainButton.addEventListener("click", () => startReading(state.theme, state.spread));
    elements.changeOptionsButton.addEventListener("click", showOptions);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(elements.form);
    const theme = formData.get("theme");
    const spread = formData.get("spread");

    if (!global.TarotEngine.THEME_LABELS[theme] || !global.TarotEngine.SPREADS[spread]) {
      showFormError("テーマとカードの引き方を選んでください。");
      return;
    }

    startReading(theme, spread);
  }

  function startReading(theme, spread) {
    const spreadDefinition = global.TarotEngine.getSpread(spread);

    try {
      state.mode = "regular";
      state.theme = theme;
      state.spread = spread;
      state.draws = global.TarotEngine.drawCards(spreadDefinition.count);
      presentReading(spreadDefinition);
    } catch (error) {
      console.error("カードの抽選に失敗しました:", error);
      showFormError("カードを引けませんでした。ページを再読み込みして、もう一度お試しください。");
    }
  }

  function startDailyReading() {
    const today = getLocalDateInfo();
    const spreadDefinition = {
      label: "今日の1枚",
      count: 1,
      positions: ["今日のカード"]
    };

    try {
      state.mode = "daily";
      state.theme = null;
      state.spread = "one";
      state.dailyDateKey = today.key;
      state.dailyDateLabel = today.label;
      state.draws = [global.TarotEngine.drawDailyCard(today.key)];
      presentReading(spreadDefinition);
    } catch (error) {
      console.error("今日の1枚を選べませんでした:", error);
      showFormError("今日の1枚を選べませんでした。ページを再読み込みして、もう一度お試しください。");
    }
  }

  function presentReading(spreadDefinition) {
    state.revealed = new Set();
    hideFormError();
    renderReading(spreadDefinition);
    elements.selectionPanel.hidden = true;
    elements.resultPanel.hidden = false;
    scrollToPanel(elements.resultPanel);
    elements.resultTitle.focus({ preventScroll: true });
  }

  function renderReading(spreadDefinition) {
    elements.cardsContainer.replaceChildren();
    elements.cardsContainer.dataset.count = String(state.draws.length);
    elements.resultTitle.textContent = state.mode === "daily" ? "今日の1枚が選ばれました" : "カードが選ばれました";
    elements.resultContext.textContent = state.mode === "daily"
      ? `${state.dailyDateLabel} ／ 今日の1枚`
      : `${global.TarotEngine.getThemeLabel(state.theme)} ／ ${spreadDefinition.label}`;
    elements.revealGuide.textContent = "カードをタップして、1枚ずつめくってください。";
    elements.revealAllButton.hidden = false;
    elements.closingMessage.hidden = true;
    elements.shareResultButton.hidden = true;
    elements.shareStatus.hidden = true;
    elements.shareStatus.textContent = "";
    elements.shareFallback.hidden = true;
    elements.shareFallbackText.value = "";
    elements.drawAgainButton.hidden = state.mode === "daily";
    elements.changeOptionsButton.textContent = state.mode === "daily"
      ? "通常の占いを選ぶ"
      : "テーマ・引き方を選び直す";

    state.draws.forEach((draw, index) => {
      const fragment = elements.cardTemplate.content.cloneNode(true);
      const article = fragment.querySelector(".draw-slot");
      const position = spreadDefinition.positions[index];
      const cardButton = fragment.querySelector(".tarot-card");
      const cardFront = fragment.querySelector(".card-front");
      const cardImage = fragment.querySelector(".card-image");
      const cardSymbol = fragment.querySelector(".card-symbol");
      const themeMessage = fragment.querySelector(".theme-message");

      article.dataset.cardIndex = String(index);
      fragment.querySelector(".position-label").textContent = position;
      cardButton.setAttribute("aria-label", `${position}のカードをめくる`);
      fragment.querySelector(".card-number").textContent = draw.card.number;
      cardSymbol.textContent = draw.card.symbol;
      fragment.querySelector(".card-name").textContent = draw.card.name;
      fragment.querySelector(".card-english").textContent = draw.card.english;
      fragment.querySelector(".orientation-badge").textContent = draw.orientationLabel;
      fragment.querySelector(".keywords").textContent = draw.meaning.keywords.join(" ・ ");
      fragment.querySelector(".reading-title").textContent = `${draw.card.number}・${draw.card.name}・${draw.orientationLabel}`;
      fragment.querySelector(".general-reading").textContent = draw.meaning.general;

      if (state.mode === "daily") {
        themeMessage.hidden = true;
      } else {
        fragment.querySelector(".theme-message-label").textContent = `${global.TarotEngine.getThemeLabel(state.theme)}へのメッセージ`;
        fragment.querySelector(".theme-message p").textContent = draw.meaning.themes[state.theme];
      }

      fragment.querySelector(".advice-message p").textContent = draw.meaning.advice;

      if (draw.card.image) {
        cardImage.src = draw.card.image;
        cardImage.hidden = false;
        cardSymbol.hidden = true;
        cardFront.classList.add("has-image");
      }

      if (draw.orientation === "reversed") {
        cardFront.classList.add("is-reversed");
      }

      cardButton.addEventListener("click", () => revealCard(index));
      elements.cardsContainer.append(fragment);
    });
  }

  function revealCard(index) {
    if (state.revealed.has(index)) {
      return;
    }

    const article = elements.cardsContainer.querySelector(`[data-card-index="${index}"]`);
    const button = article.querySelector(".tarot-card");
    const reading = article.querySelector(".card-reading");
    const position = global.TarotEngine.getSpread(state.spread).positions[index];
    const draw = state.draws[index];

    state.revealed.add(index);
    button.classList.add("is-revealed");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", `${position}は${draw.card.name}の${draw.orientationLabel}です`);
    reading.hidden = false;

    if (state.revealed.size === state.draws.length) {
      showClosingMessage();
    }
  }

  function revealAllCards() {
    state.draws.forEach((_, index) => revealCard(index));
  }

  function showClosingMessage() {
    const finalDraw = state.draws[state.draws.length - 1];
    let prefix;

    if (state.mode === "daily") {
      prefix = `今日の「${finalDraw.card.name}」からのヒントです。`;
    } else {
      prefix = state.spread === "three"
        ? `未来に現れた「${finalDraw.card.name}」からのヒントです。`
        : `「${finalDraw.card.name}」からのヒントです。`;
    }

    elements.revealGuide.textContent = "すべてのカードが開かれました。気になった言葉を受け取ってください。";
    elements.revealAllButton.hidden = true;
    elements.closingText.textContent = `${prefix}${finalDraw.meaning.advice}`;
    elements.closingMessage.hidden = false;
    elements.shareResultButton.hidden = false;
  }

  async function handleShare() {
    const shareText = buildShareText();
    const copyValue = `${shareText}\n${global.location.href}`;
    const shareData = {
      title: "月灯りのタロット",
      text: shareText,
      url: global.location.href
    };

    elements.shareStatus.hidden = true;

    try {
      if (global.navigator && typeof global.navigator.share === "function") {
        await global.navigator.share(shareData);
        showShareStatus("共有できました。");
      } else {
        await copyText(copyValue);
        showShareStatus("結果をコピーしました。");
      }
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }

      console.error("結果を共有できませんでした:", error);
      showManualShare(copyValue);
      showShareStatus("共有用の文章を表示しました。下の欄からコピーしてください。");
    }
  }

  function buildShareText() {
    const spreadDefinition = global.TarotEngine.getSpread(state.spread);
    const positions = state.mode === "daily" ? ["今日のカード"] : spreadDefinition.positions;
    const heading = state.mode === "daily"
      ? `今日の1枚｜${state.dailyDateLabel}`
      : `${global.TarotEngine.getThemeLabel(state.theme)}｜${spreadDefinition.label}`;
    const cards = state.draws.map((draw, index) => (
      `${positions[index]}：${draw.card.name}（${draw.orientationLabel}）`
    ));
    const finalDraw = state.draws[state.draws.length - 1];

    return [
      "月灯りのタロット",
      heading,
      ...cards,
      `今日の小さな一歩：${finalDraw.meaning.advice}`
    ].join("\n");
  }

  async function copyText(text) {
    if (global.navigator && global.navigator.clipboard && global.isSecureContext) {
      try {
        await global.navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        console.warn("標準のコピー機能を利用できないため、予備の方法へ切り替えます。", error);
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("コピーに失敗しました。");
    }
  }

  function showShareStatus(message, isError = false) {
    elements.shareStatus.textContent = message;
    elements.shareStatus.classList.toggle("is-error", isError);
    elements.shareStatus.hidden = false;
  }

  function showManualShare(text) {
    elements.shareFallbackText.value = text;
    elements.shareFallback.hidden = false;
    elements.shareFallbackText.focus();
    elements.shareFallbackText.select();
  }

  function showOptions() {
    elements.resultPanel.hidden = true;
    elements.selectionPanel.hidden = false;
    scrollToPanel(elements.selectionPanel);
    document.querySelector("#main-title").focus({ preventScroll: true });
  }

  function getLocalDateInfo(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const label = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    }).format(date);

    return {
      key: `${year}-${month}-${day}`,
      label
    };
  }

  function scrollToPanel(panel) {
    const reduceMotion = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function showFormError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = false;
  }

  function hideFormError() {
    elements.formError.textContent = "";
    elements.formError.hidden = true;
  }

  function showFatalError(message) {
    if (elements.formError) {
      showFormError(message);
    }
  }

  initialize();
})(window);
