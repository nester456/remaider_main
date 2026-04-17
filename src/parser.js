function detectType(text) {
  if (!text) return null;

  const t = text.toLowerCase();

  if (t.includes("повітряна тривога")) return "alert";
  if (t.includes("відбій")) return "clear";

  return null;
}

module.exports = {
  detectType
};