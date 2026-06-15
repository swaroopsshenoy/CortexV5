import { create } from "zustand";

const initialCode = `#include <iostream>
int main() {
  std::cout << "Hello CortexV5" << std::endl
  return 0;
}`;

function normalizeWorkspacePath(inputPath) {
  const normalized = String(inputPath ?? "")
    .trim()
    .replace(/\//g, "\\")
    .replace(/^\\+/, "")
    .replace(/\\+/g, "\\");
  if (normalized.toLowerCase() === "workspace") {
    return "";
  }
  return normalized.replace(/^workspace\\/i, "");
}

function getLabelFromPath(inputPath) {
  const normalized = normalizeWorkspacePath(inputPath);
  const segments = normalized.split("\\").filter(Boolean);
  return segments.at(-1) ?? "untitled.cpp";
}

function isSameOrDescendantPath(candidatePath, basePath) {
  const normalizedCandidate = normalizeWorkspacePath(candidatePath);
  const normalizedBase = normalizeWorkspacePath(basePath);
  return (
    normalizedCandidate === normalizedBase ||
    normalizedCandidate.startsWith(`${normalizedBase}\\`)
  );
}

const createTab = (index = 1) => ({
  id: `tab-${Date.now()}-${index}`,
  label: `main${index}.cpp`,
  path: `main${index}.cpp`,
  code: initialCode,
  language: "cpp"
});

export const useEditorStore = create((set, get) => ({
  tabs: [createTab()],
  activeTabId: "",
  init() {
    const current = get();
    if (!current.activeTabId && current.tabs.length > 0) {
      set({ activeTabId: current.tabs[0].id });
    }
  },
  addTab() {
    const nextIndex = get().tabs.length + 1;
    const nextTab = createTab(nextIndex);
    set((state) => ({
      tabs: [...state.tabs, nextTab],
      activeTabId: nextTab.id
    }));
  },
  setActiveTab(tabId) {
    set({ activeTabId: tabId });
  },
  closeTab(tabId) {
    set((state) => {
      const closingIndex = state.tabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex === -1) {
        return state;
      }

      const remainingTabs = state.tabs.filter((tab) => tab.id !== tabId);
      if (remainingTabs.length === 0) {
        const fallbackTab = createTab();
        return {
          tabs: [fallbackTab],
          activeTabId: fallbackTab.id
        };
      }

      if (state.activeTabId !== tabId) {
        return { tabs: remainingTabs };
      }

      const nextActiveTab = remainingTabs[Math.max(0, closingIndex - 1)] ?? remainingTabs[0];
      return {
        tabs: remainingTabs,
        activeTabId: nextActiveTab.id
      };
    });
  },
  openWorkspaceTab(payload) {
    const normalizedPath = normalizeWorkspacePath(payload.path);
    const label = getLabelFromPath(normalizedPath);
    const nextCode = typeof payload.code === "string" ? payload.code : "";

    set((state) => {
      const existingTab = state.tabs.find((tab) => tab.path === normalizedPath);
      if (existingTab) {
        return {
          tabs: state.tabs.map((tab) =>
            tab.id === existingTab.id ? { ...tab, code: nextCode, label } : tab
          ),
          activeTabId: existingTab.id
        };
      }

      const nextTab = {
        id: `tab-${Date.now()}-${state.tabs.length + 1}`,
        label,
        path: normalizedPath,
        code: nextCode,
        language: "cpp"
      };
      return {
        tabs: [...state.tabs, nextTab],
        activeTabId: nextTab.id
      };
    });
  },
  renameWorkspacePath(targetPath, nextPath) {
    const normalizedTargetPath = normalizeWorkspacePath(targetPath);
    const normalizedNextPath = normalizeWorkspacePath(nextPath);

    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (!isSameOrDescendantPath(tab.path, normalizedTargetPath)) {
          return tab;
        }

        const suffix = tab.path.slice(normalizedTargetPath.length);
        const remappedPath = `${normalizedNextPath}${suffix}`;
        return {
          ...tab,
          path: remappedPath,
          label: getLabelFromPath(remappedPath)
        };
      })
    }));
  },
  removeWorkspacePath(targetPath) {
    const normalizedTargetPath = normalizeWorkspacePath(targetPath);
    set((state) => {
      const remainingTabs = state.tabs.filter(
        (tab) => !isSameOrDescendantPath(tab.path, normalizedTargetPath)
      );
      if (remainingTabs.length === 0) {
        const fallbackTab = createTab();
        return {
          tabs: [fallbackTab],
          activeTabId: fallbackTab.id
        };
      }

      const activeStillExists = remainingTabs.some((tab) => tab.id === state.activeTabId);
      return {
        tabs: remainingTabs,
        activeTabId: activeStillExists ? state.activeTabId : remainingTabs[0].id
      };
    });
  },
  updateActiveCode(nextCode) {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, code: nextCode } : tab
      )
    }));
  }
}));
