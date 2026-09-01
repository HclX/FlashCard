(() => {
  const STORAGE_KEY = 'flashcard-study:best-scores';

  // ---- DOM refs ----
  const views = {
    picker: document.getElementById('view-picker'),
    game: document.getElementById('view-game'),
    summary: document.getElementById('view-summary'),
  };
  const deckGrid = document.getElementById('deck-grid');
  const pickerEmpty = document.getElementById('picker-empty');
  const masteryStreakInput = document.getElementById('mastery-streak');
  const chkBidirectional = document.getElementById('chk-bidirectional');

  const quizPrompt = document.getElementById('quiz-prompt');
  const quizHint = document.getElementById('quiz-hint');
  const quizImage = document.getElementById('quiz-image');
  const quizForm = document.getElementById('quiz-form');
  const quizInput = document.getElementById('quiz-input');
  const quizSubmit = document.getElementById('quiz-submit');
  const quizFormatTip = document.getElementById('quiz-format-tip');
  const quizFeedback = document.getElementById('quiz-feedback');
  const quizFeedbackLine = document.getElementById('quiz-feedback-line');
  const quizInfoLine = document.getElementById('quiz-info-line');
  const quizOverride = document.getElementById('quiz-override');
  const btnQuizNext = document.getElementById('btn-quiz-next');

  const gameDeckName = document.getElementById('game-deck-name');
  const gameProgressText = document.getElementById('game-progress-text');
  const gameScore = document.getElementById('game-score');
  const progressFill = document.getElementById('progress-fill');

  const btnSkip = document.getElementById('btn-skip');
  const btnBack = document.getElementById('btn-back');
  const chkShuffle = document.getElementById('chk-shuffle');

  const summaryScore = document.getElementById('summary-score');
  const summaryLine = document.getElementById('summary-line');
  const summaryStats = document.getElementById('summary-stats');
  const btnStudyAgain = document.getElementById('btn-study-again');
  const btnAllDecks = document.getElementById('btn-all-decks');

  // ---- State ----
  let domains = [];
  let activeDomain = null;
  let activeCards = [];
  let game = null;
  let bidirectional = true;
  let currentDirection = 'forward'; // 'forward': front is prompt, back is answer. 'reverse': flipped.
  let quizGraded = false; // current card's correct/incorrect verdict, pending commit

  // ---- Quiz answer grading: plain phrases (word-based, lenient) ----
  function normalizeAnswer(str) {
    return str
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ') // drop parenthetical notes, e.g. "Iron (II)"
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function acceptableAnswers(back) {
    // Only "or" and "/" are treated as alternate-answer separators — a
    // comma is just punctuation within a single answer (e.g. "The check,
    // please"), not a list of alternatives.
    return back
      .split(/\bor\b|\//i)
      .map(normalizeAnswer)
      .filter(Boolean);
  }

  function isAnswerCorrect(input, expected) {
    const norm = normalizeAnswer(input);
    if (!norm) return false;
    return acceptableAnswers(expected).includes(norm);
  }

  // ---- Quiz answer grading: chemical formulas / symbols ----
  // Lets a student type formulas on a plain keyboard instead of needing to
  // produce actual Unicode sub/superscript characters: "Fe2+" is accepted
  // for "Fe²⁺", "SO4^2-" or "SO4 2-" for "SO₄²⁻", etc.
  const FORMULA_CHAR_MAP = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '-',
  };
  const FORMULA_CHAR_RE = /[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g;

  function normalizeFormula(str) {
    let s = str.trim().replace(FORMULA_CHAR_RE, (ch) => FORMULA_CHAR_MAP[ch]);
    s = s.replace(/\^/g, ''); // some people type "^2+" for a superscript charge
    s = s.replace(/\s+/g, ''); // formulas don't carry meaningful whitespace
    s = s.replace(/([+-])(\d+)$/, '$2$1'); // "+2"/"-2" -> "2+"/"2-"
    return s.toLowerCase();
  }

  function isFormulaCorrect(input, expected) {
    const norm = normalizeFormula(input);
    if (!norm) return false;
    return norm === normalizeFormula(expected);
  }

  // A string "looks like a formula" if it carries a digit (plain or
  // sub/superscript) or a charge sign — that's exactly the notation the
  // word-based grader would otherwise mangle (it treats unicode
  // sub/superscript characters as punctuation and drops them).
  function looksLikeFormula(str) {
    return /[0-9₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(str) || /[⁺⁻+-]\s*$/.test(str);
  }

  function gradeAnswer(input, expected) {
    return looksLikeFormula(expected) ? isFormulaCorrect(input, expected) : isAnswerCorrect(input, expected);
  }

  function expectedAnswerFor(card) {
    return currentDirection === 'forward' ? card.back : card.front;
  }

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => el.classList.toggle('active', key === name));
  }

  // ---- Score persistence ----
  function loadScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }
  function saveBestScore(domainId, score) {
    const scores = loadScores();
    const prevBest = scores[domainId]?.best;
    if (prevBest === undefined || score > prevBest) {
      scores[domainId] = { best: score };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    }
  }
  function getBestScore(domainId) {
    return loadScores()[domainId] || null;
  }

  // ---- Deck picker ----
  async function init() {
    domains = await DeckLoader.listDomains();
    renderDeckGrid();
    showView('picker');
  }

  function renderDeckGrid() {
    deckGrid.innerHTML = '';
    if (domains.length === 0) {
      pickerEmpty.hidden = false;
      return;
    }
    pickerEmpty.hidden = true;

    domains.forEach((domain, i) => {
      const btn = document.createElement('button');
      btn.className = 'deck-card';
      btn.type = 'button';
      btn.dataset.index = String(i + 1).padStart(2, '0');

      const best = getBestScore(domain.id);
      const bestLine = best ? `Best score: ${best.best}` : 'Not studied yet';

      btn.innerHTML = `
        <span class="deck-icon">${domain.icon || '\u{1F0CF}'}</span>
        <h3>${escapeHTML(domain.name || domain.folder)}</h3>
        <p>${escapeHTML(domain.description || '')}</p>
        <div class="deck-meta">
          <span>${domain.cardCount ? domain.cardCount + ' cards' : ' '}</span>
          <span class="deck-best">${bestLine}</span>
        </div>
      `;
      btn.addEventListener('click', () => startDomain(domain));
      deckGrid.appendChild(btn);
    });
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Starting / running a session ----
  async function startDomain(domain) {
    activeDomain = domain;
    bidirectional = chkBidirectional.checked;
    try {
      activeCards = await DeckLoader.loadCards(domain);
    } catch (err) {
      console.error(err);
      alert(`Couldn't load cards for "${domain.name}". Check the browser console for details.`);
      return;
    }
    domain.cardCount = activeCards.length;
    beginSession(activeCards, chkShuffle.checked);
  }

  function beginSession(cards, shuffle) {
    const masteryStreak = Math.min(10, Math.max(1, parseInt(masteryStreakInput.value, 10) || 3));
    game = new QuizSession(cards, { shuffle, masteryStreak });
    gameDeckName.textContent = activeDomain.name || activeDomain.folder;
    showView('game');
    renderCard();
  }

  function renderCard() {
    const totalCards = game.totalCards;
    const masteredCount = game.masteredCount;

    gameProgressText.textContent = `${masteredCount} / ${totalCards} mastered`;
    progressFill.style.width = `${totalCards ? (masteredCount / totalCards) * 100 : 0}%`;
    gameScore.textContent = `Score: ${game.score}`;

    if (game.isFinished) {
      finishSession();
      return;
    }

    renderQuizCard(game.current);
  }

  function renderQuizCard(card) {
    currentDirection = bidirectional && Math.random() < 0.5 ? 'reverse' : 'forward';
    const promptText = currentDirection === 'forward' ? card.front : card.back;
    const expected = expectedAnswerFor(card);

    quizPrompt.textContent = promptText;

    // Hint/image describe the front, so they'd give away the answer when
    // the front is what the student needs to produce (reverse direction).
    if (currentDirection === 'forward' && card.hint) {
      quizHint.textContent = `Hint: ${card.hint}`;
      quizHint.hidden = false;
    } else {
      quizHint.hidden = true;
    }

    if (currentDirection === 'forward' && card.image) {
      quizImage.src = card.image;
      quizImage.alt = '';
      quizImage.hidden = false;
    } else {
      quizImage.hidden = true;
    }

    if (looksLikeFormula(expected)) {
      quizFormatTip.textContent =
        'Tip: plain keys work — type digits normally and use +/- for charges (e.g. "Fe2+" for Fe²⁺).';
      quizFormatTip.hidden = false;
    } else {
      quizFormatTip.hidden = true;
    }

    quizInput.value = '';
    quizInput.disabled = false;
    quizSubmit.disabled = false;
    quizFeedback.hidden = true;
    quizInfoLine.hidden = true;
    quizOverride.hidden = true;
    btnQuizNext.hidden = true;
    quizGraded = false;

    requestAnimationFrame(() => quizInput.focus());
  }

  // Shown only once an answer is graded correct — the "why is that the
  // answer" note, not a hint for getting there.
  function showInfoIfPresent(card) {
    if (card.info) {
      quizInfoLine.textContent = card.info;
      quizInfoLine.hidden = false;
    } else {
      quizInfoLine.hidden = true;
    }
  }

  function checkQuizAnswer() {
    const card = game.current;
    if (!card || quizInput.disabled) return;

    const expected = expectedAnswerFor(card);
    const correct = gradeAnswer(quizInput.value, expected);
    quizGraded = correct;
    quizInput.disabled = true;
    quizSubmit.disabled = true;
    quizFeedback.hidden = false;

    if (correct) {
      quizFeedbackLine.textContent = `✓ Correct — ${expected}`;
      quizFeedbackLine.className = 'quiz-feedback-line correct';
      quizOverride.hidden = true;
      showInfoIfPresent(card);
    } else {
      quizFeedbackLine.textContent = `✗ Not quite. Answer: ${expected}`;
      quizFeedbackLine.className = 'quiz-feedback-line incorrect';
      quizOverride.hidden = false;
      quizInfoLine.hidden = true;
    }

    btnQuizNext.hidden = false;
    btnQuizNext.focus();
  }

  function overrideQuizGrade() {
    const card = game.current;
    if (!card) return;
    quizGraded = true;
    quizFeedbackLine.textContent = `✓ Marked correct — ${expectedAnswerFor(card)}`;
    quizFeedbackLine.className = 'quiz-feedback-line correct';
    quizOverride.hidden = true;
    showInfoIfPresent(card);
  }

  function goToNextQuizCard() {
    if (!game.current) return;
    game.submitAnswer(quizGraded);
    renderCard();
  }

  function skip() {
    if (!game.current) return;
    game.skip();
    renderCard();
  }

  function finishSession() {
    saveBestScore(activeDomain.id, game.score);

    summaryScore.textContent = game.score;
    summaryLine.textContent = summaryMessage(game);
    const accuracy = game.totalAnswered ? Math.round((game.correctCount / game.totalAnswered) * 100) : 0;
    summaryStats.textContent =
      `${game.totalCards} cards mastered · ${game.totalAnswered} questions answered · ${accuracy}% correct`;

    showView('summary');
  }

  function summaryMessage(finishedGame) {
    if (finishedGame.totalCards === 0) return 'This deck has no cards yet.';
    if (finishedGame.incorrectCount === 0) return 'Perfect run — every card correct from the start.';
    const accuracy = finishedGame.correctCount / finishedGame.totalAnswered;
    if (accuracy >= 0.8) return 'Strong session. Every card mastered.';
    if (accuracy >= 0.5) return 'Every card mastered — a few needed extra reps.';
    return 'Every card mastered, though it took some persistence. Come back for another round.';
  }

  // ---- Wiring ----
  quizForm.addEventListener('submit', (e) => {
    e.preventDefault();
    checkQuizAnswer();
  });
  quizOverride.addEventListener('click', overrideQuizGrade);
  btnQuizNext.addEventListener('click', goToNextQuizCard);
  btnSkip.addEventListener('click', skip);

  btnBack.addEventListener('click', () => showView('picker'));
  btnAllDecks.addEventListener('click', () => { renderDeckGrid(); showView('picker'); });

  btnStudyAgain.addEventListener('click', () => beginSession(activeCards, chkShuffle.checked));

  init();
})();
