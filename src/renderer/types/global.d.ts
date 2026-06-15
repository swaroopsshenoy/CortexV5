import type { WindowApi } from "../../shared/ipc/contracts";

declare global {
  interface Window {
    api: WindowApi;
  }
}

export {};
