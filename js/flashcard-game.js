/**
 * QuizSession
 * Holds the state for one study session: a rotating queue of cards, each
 * card's current correct-in-a-row streak, and the running score.
 *
 * A card is "mastered" (and leaves the queue for good) once its streak
 * reaches `masteryStreak`. Missing a card resets its streak to 0 and
 * reinserts it near the front of the queue (so it comes back soon);
 * answering correctly but not yet mastering it reinserts the card at the
 * back (so it's seen less often than cards you're getting wrong). The
 * session ends when the queue is empty, which happens exactly when every
 * card has been mastered.
 */
class QuizSession {
  constructor(cards, { shuffle = false, masteryStreak = 3 } = {}) {
    this.cards = cards;
    this.masteryStreak = Math.max(1, masteryStreak);
    this.streaks = new Map(cards.map((c) => [c.id, 0]));
    this.mastered = new Set();
    this.score = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.queue = shuffle ? QuizSession.shuffled(cards) : [...cards];
  }

  static shuffled(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  get current() {
    return this.queue[0] || null;
  }

  get totalCards() {
    return this.cards.length;
  }

  get masteredCount() {
    return this.mastered.size;
  }

  get totalAnswered() {
    return this.correctCount + this.incorrectCount;
  }

  get isFinished() {
    return this.queue.length === 0;
  }

  /** Record an answer for the current card; advances the queue. */
  submitAnswer(correct) {
    const card = this.current;
    if (!card) return;
    this.queue.shift();

    if (correct) {
      this.score += 1;
      this.correctCount += 1;
      const streak = (this.streaks.get(card.id) || 0) + 1;
      this.streaks.set(card.id, streak);

      if (streak >= this.masteryStreak) {
        this.mastered.add(card.id);
      } else {
        this.queue.push(card); // seen less often than missed cards
      }
    } else {
      this.score -= 1;
      this.incorrectCount += 1;
      this.streaks.set(card.id, 0);
      const reinsertAt = Math.min(2, this.queue.length);
      this.queue.splice(reinsertAt, 0, card); // seen again soon
    }
  }

  /** Move the current card to the back of the queue without judging it. */
  skip() {
    const card = this.current;
    if (!card) return;
    this.queue.shift();
    this.queue.push(card);
  }
}
