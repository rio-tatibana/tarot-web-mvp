(function (global) {
  "use strict";

  const state = {
    theme: "love",
    spread: "one",
    draws: [],
    revealed: new Set()
  };

  const elements = {};

  function initialize() {
    Object.assign(elements, {
      selectionPanel: document.querySelector("#selection-panel"),
      resultPanel: document.querySelector("#result-panel"),
      form: document.querySelector("#reading-form"),
      formError: document.querySelector("#form-error"),
      resultTitle: document.querySelector("#result-title"),
      resultContext: document.querySelector("#result-context"),
      revealGuide: document.querySelector("#reveal-guide"),
      cardsContainer: document.querySelector("#cards-container"),
      revealAllButton: document.querySelector("#reveal-all-button"),
      closingMessage: document.querySelector("#closing-message"),
      closingText: document.querySelector("#closing-text"),
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

    elements.form.addEventListener("submit", handleSubmit);
    elements.revealAllButton.addEventListener("click", revealAllCards);
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
      state.theme = theme;
      state.spread = spread;
      state.draws = global.TarotEngine.drawCards(spreadDefinition.count);
      state.revealed = new Set();
      hideFormError();
      renderReading(spreadDefinition);
      elements.selectionPanel.hidden = true;
      elements.resultPanel.hidden = false;
      scrollToPanel(elements.resultPanel);
      elements.resultTitle.focus({ preventScroll: true });
    } catch (error) {
      console.error("カードの抽選に失敗しました:", error);
      showFormError("カードを引けませんでした。ページを再読み込みして、もう一度お試しください。");
    }
  }

  function renderReading(spreadDefinition) {
    elements.cardsContainer.replaceChildren();
    elements.cardsContainer.dataset.count = String(state.draws.length);
    elements.resultContext.textContent = `${global.TarotEngine.getThemeLabel(state.theme)} ／ ${spreadDefinition.label}`;
    elements.revealGuide.textContent = "カードをタップして、1枚ずつめくってください。";
    elements.revealAllButton.hidden = false;
    elements.closingMessage.hidden = true;

    state.draws.forEach((draw, index) => {
      const fragment = elements.cardTemplate.content.cloneNode(true);
      const article = fragment.querySelector(".draw-slot");
      const position = spreadDefinition.positions[index];
      const cardButton = fragment.querySelector(".tarot-card");
      const cardFront = fragment.querySelector(".card-front");
      const cardImage = fragment.querySelector(".card-image");
      const cardSymbol = fragment.querySelector(".card-symbol");

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
      fragment.querySelector(".theme-message-label").textContent = `${global.TarotEngine.getThemeLabel(state.theme)}へのメッセージ`;
      fragment.querySelector(".theme-message p").textContent = draw.meaning.themes[state.theme];
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
    const prefix = state.spread === "three"
      ? `未来に現れた「${finalDraw.card.name}」からのヒントです。`
      : `「${finalDraw.card.name}」からのヒントです。`;

    elements.revealGuide.textContent = "すべてのカードが開かれました。気になった言葉を受け取ってください。";
    elements.revealAllButton.hidden = true;
    elements.closingText.textContent = `${prefix}${finalDraw.meaning.advice}`;
    elements.closingMessage.hidden = false;
  }

  function showOptions() {
    elements.resultPanel.hidden = true;
    elements.selectionPanel.hidden = false;
    scrollToPanel(elements.selectionPanel);
    document.querySelector("#main-title").focus({ preventScroll: true });
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
