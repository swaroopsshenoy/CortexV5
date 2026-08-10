const fs = require("node:fs/promises");
const path = require("node:path");

function extractKeywords(text) {
  if (typeof text !== "string") {
    return new Set();
  }
  const normalized = text.toLowerCase();
  const words = normalized.match(/\b\w+\b/g) || [];
  return new Set(words);
}

function createAlgorithmRecommendationService(options = {}) {
  const databasePath = options.databasePath || path.resolve(__dirname, "..", "..", "..", "resources", "algorithms_db.json");
  let dbCache = null;

  async function loadDatabase() {
    if (dbCache) {
      return dbCache;
    }
    try {
      const raw = await fs.readFile(databasePath, "utf8");
      dbCache = JSON.parse(raw);
      return dbCache;
    } catch (err) {
      console.error(`Failed to load algorithms database from ${databasePath}:`, err);
      return { algorithms: [] };
    }
  }

  return Object.freeze({
    async recommend(textPayload) {
      const db = await loadDatabase();
      const keywords = extractKeywords(textPayload);
      const recommendations = [];

      for (const algo of db.algorithms || []) {
        let score = 0;
        
        // Keyword match
        for (const kw of algo.keywords || []) {
          const kwLower = kw.toLowerCase();
          if (kwLower.includes(" ")) {
            if (textPayload.toLowerCase().includes(kwLower)) {
              score += 2;
            }
          } else if (keywords.has(kwLower)) {
            score += 2;
          }
        }

        // Category match
        for (const cat of algo.categories || []) {
          const catLower = cat.toLowerCase();
          if (catLower.includes(" ")) {
            if (textPayload.toLowerCase().includes(catLower)) {
              score += 1;
            }
          } else if (keywords.has(catLower)) {
            score += 1;
          }
        }

        if (score > 0) {
          recommendations.push({
            name: algo.name,
            score,
            complexity: algo.complexity,
            use_when: algo.use_when,
            template: algo.cpp_template,
            notes: algo.notes
          });
        }
      }

      recommendations.sort((a, b) => b.score - a.score);
      return recommendations;
    }
  });
}

module.exports = {
  createAlgorithmRecommendationService
};
