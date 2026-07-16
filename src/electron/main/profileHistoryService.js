const fs = require("node:fs/promises");
const path = require("node:path");

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty string`);
  }
}

function normalizeStoredEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  if (typeof entry.timestamp !== "string" || entry.timestamp.trim().length === 0) {
    return null;
  }
  if (typeof entry.meanMs !== "number" || Number.isNaN(entry.meanMs) || entry.meanMs < 0) {
    return null;
  }
  return {
    timestamp: entry.timestamp,
    meanMs: entry.meanMs,
    file: entry.file
  };
}

function normalizeNewEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Profile history entry must be object");
  }
  if (typeof entry.timestamp !== "string" || entry.timestamp.trim().length === 0) {
    throw new Error("Profile history timestamp must be string");
  }
  if (typeof entry.meanMs !== "number" || Number.isNaN(entry.meanMs) || entry.meanMs < 0) {
    throw new Error("Profile history meanMs must be non-negative number");
  }
  return {
    timestamp: entry.timestamp,
    meanMs: entry.meanMs,
    file: entry.file
  };
}

function toTimestampMs(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => toTimestampMs(left.timestamp) - toTimestampMs(right.timestamp));
}

function createProfileHistoryService(options = {}) {
  assertNonEmptyString(options.storagePath, "storagePath");
  const maxEntries =
    options.maxEntries === undefined ? 200 : Number.isInteger(options.maxEntries) ? options.maxEntries : NaN;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("maxEntries must be positive integer");
  }

  async function readHistory() {
    try {
      const raw = await fs.readFile(options.storagePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map(normalizeStoredEntry).filter(Boolean);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async function writeHistory(entries) {
    await fs.mkdir(path.dirname(options.storagePath), { recursive: true });
    await fs.writeFile(options.storagePath, JSON.stringify(entries, null, 2), "utf8");
  }

  async function append(entry) {
    const normalized = normalizeNewEntry(entry);
    const history = await readHistory();
    const nextHistory = sortEntries([...history, normalized]).slice(-maxEntries);
    await writeHistory(nextHistory);
    return normalized;
  }

  async function list(limit = 10) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("limit must be positive integer");
    }
    const history = await readHistory();
    return sortEntries(history).slice(-limit);
  }

  return Object.freeze({
    append,
    list
  });
}

module.exports = { createProfileHistoryService };
