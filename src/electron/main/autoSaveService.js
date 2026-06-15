"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");

const AUTOSAVE_DIR_NAME = ".autosave";
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds
const AUTOSAVE_EXT = ".autosave";

function createAutoSaveService({ workspaceRoot }) {
  const autosaveDir = path.join(workspaceRoot, AUTOSAVE_DIR_NAME);
  let intervalHandle = null;
  let pendingEntries = new Map(); // relativePath -> content

  function toAutosavePath(relativePath) {
    const sanitized = relativePath.replace(/[\\/]/g, "_");
    return path.join(autosaveDir, `${sanitized}${AUTOSAVE_EXT}`);
  }

  async function flush() {
    if (pendingEntries.size === 0) {
      return;
    }
    await fs.mkdir(autosaveDir, { recursive: true });
    const snapshot = new Map(pendingEntries);
    pendingEntries.clear();

    await Promise.allSettled(
      [...snapshot.entries()].map(async ([relativePath, content]) => {
        const dest = toAutosavePath(relativePath);
        await fs.writeFile(dest, content, "utf8");
      })
    );
  }

  function stage(relativePath, content) {
    if (typeof relativePath !== "string" || relativePath.trim().length === 0) return;
    if (typeof content !== "string") return;
    pendingEntries.set(relativePath, content);
  }

  async function recover(relativePath) {
    if (typeof relativePath !== "string") return null;
    const src = toAutosavePath(relativePath);
    try {
      return await fs.readFile(src, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async function listRecoverable() {
    try {
      await fs.mkdir(autosaveDir, { recursive: true });
      const entries = await fs.readdir(autosaveDir);
      return entries
        .filter((name) => name.endsWith(AUTOSAVE_EXT))
        .map((name) => name.slice(0, -AUTOSAVE_EXT.length).replace(/_/g, "\\"));
    } catch {
      return [];
    }
  }

  async function discard(relativePath) {
    const target = toAutosavePath(relativePath);
    try {
      await fs.unlink(target);
    } catch {
      // already gone
    }
  }

  function start() {
    if (intervalHandle) return;
    intervalHandle = setInterval(() => {
      flush().catch(() => {});
    }, AUTOSAVE_INTERVAL_MS);
    intervalHandle.unref?.();
  }

  function stop() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  return { stage, flush, recover, listRecoverable, discard, start, stop };
}

module.exports = { createAutoSaveService };
