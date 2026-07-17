const placeholderReplyPattern = /\b(?:can|will|need to)\s+(?:confirm|provide|share|send|add)\b/i;

function normalizeMessage(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function similarity(left, right) {
  const leftWords = new Set(left.split(" ").filter(Boolean));
  const rightWords = new Set(right.split(" ").filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / new Set([...leftWords, ...rightWords]).size;
}

export function filterSuggestedReplies(suggestions, messages = []) {
  const previous = messages
    .filter((message) => message?.role === "user")
    .map((message) => normalizeMessage(message.content))
    .filter(Boolean);
  const accepted = [];

  for (const suggestion of suggestions) {
    const normalized = normalizeMessage(suggestion);
    const repeatsPrevious = previous.some((message) => (
      normalized === message || similarity(normalized, message) >= 0.75
    ));
    const repeatsSuggestion = accepted.some((item) => normalizeMessage(item) === normalized);
    if (!normalized || placeholderReplyPattern.test(suggestion) || repeatsPrevious || repeatsSuggestion) {
      continue;
    }
    accepted.push(suggestion);
  }

  return accepted;
}
