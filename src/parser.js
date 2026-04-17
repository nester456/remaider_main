function normalize(text) {
  return text
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectType(text) {
  if (!text) return null;

  if (text.includes("Повітряна тривога")) return "alert";
  if (text.includes("Відбій")) return "clear";

  return null;
}

function extractRegions(text) {
  if (!text) return [];

  const lines = text.split("\n");

  // 🔥 беремо хештеги (найнадійніше)
  const hashtags = lines
    .filter(line => line.includes("#"))
    .map(line => normalize(line));

  if (hashtags.length) return hashtags;

  // fallback
  return lines
    .map(line => normalize(line))
    .filter(line =>
      line &&
      !line.includes("повітряна") &&
      !line.includes("відбій")
    );
}

function parseMessage(text) {
  const type = detectType(text);
  if (!type) return null;

  const regions = extractRegions(text);

  return { type, regions };
}

module.exports = {
  normalize,
  parseMessage,
};