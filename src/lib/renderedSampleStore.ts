import type { Sample } from "@/types";

const DB_NAME = "beatmaker-rendered-samples";
const DB_VERSION = 1;
const STORE_NAME = "samples";

export type StoredRenderedSample = {
  id: string;
  name: string;
  filename: string;
  type: Sample["type"];
  category: Sample["category"];
  durationMs?: number;
  createdAt: number;
  audio: Blob;
  metadata?: Record<string, unknown>;
  isImported?: boolean;
  sourceLabel?: "rendered" | "imported" | "converted";
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB is not available.")); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open rendered sample storage."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Rendered sample storage failed."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Rendered sample storage transaction failed.")); };
  });
}

export async function saveRenderedSample(record: StoredRenderedSample) {
  await withStore("readwrite", (store) => store.put(record));
}

export async function deleteRenderedSample(id: string) {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function loadRenderedSamples(): Promise<Sample[]> {
  const records = await withStore<StoredRenderedSample[]>("readonly", (store) => store.getAll());
  return records.sort((a, b) => b.createdAt - a.createdAt).map((record) => ({
    id: record.id,
    name: record.name,
    filename: record.filename,
    type: record.type,
    category: record.category,
    durationMs: record.durationMs,
    durationSeconds: record.durationMs ? record.durationMs / 1000 : undefined,
    path: URL.createObjectURL(record.audio),
    source: "indexeddb",
    loadStatus: record.isImported && record.metadata?.decodeStatus === "decode-failed" ? "decode-failed" : "loaded",
    lastErrorMessage: typeof record.metadata?.lastErrorMessage === "string" ? record.metadata.lastErrorMessage : undefined,
    isRendered: !record.isImported,
    isImported: record.isImported,
    metadata: record.metadata
  }));
}

export async function hasRenderedSample(id: string): Promise<boolean> {
  const item = await withStore<StoredRenderedSample | undefined>("readonly", (store) => store.get(id));
  return Boolean(item);
}
