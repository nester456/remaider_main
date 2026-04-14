// src/parser.js

// 🔧 нормалізація тексту
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// 🔍 визначення типу повідомлення
function detectType(text) {
  if (!text) return null;

  if (text.includes("Повітряна тривога")) return "alert";
  if (text.includes("Відбій")) return "clear";

  return null;
}

// 🗺 витяг районів
function extractRegions(text) {
  if (!text) return [];

  return text
    .split("\n")
    .map(line => line.replace("•", "").trim())
    .filter(line =>
      line &&
      !line.includes("Повітряна") &&
      !line.includes("Відбій")
    );
}

// 🎯 головна функція
function parseMessage(text) {
  const type = detectType(text);

  if (!type) return null;

  const regions = extractRegions(text);

  return {
    type,      // alert / clear
    regions    // список районів
  };
}

module.exports = {
  normalize,
  parseMessage,
};