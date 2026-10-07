import { Injectable } from '@angular/core';

export interface SetupDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<SetupFileHandle>;
  queryPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface SetupFileHandle {
  createWritable(): Promise<SetupWritableFileStream>;
}

interface SetupWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }): Promise<SetupDirectoryHandle>;
}

const DATABASE_NAME = 'candeweb-preferences';
const STORE_NAME = 'directory-handles';
const DATABASE_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class SetupInstallDirectoryService {
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof indexedDB !== 'undefined' &&
      'showDirectoryPicker' in window
    );
  }

  chooseDirectory(): Promise<SetupDirectoryHandle> {
    if (!this.isSupported()) return Promise.reject(new Error('DIRECTORY_PICKER_UNSUPPORTED'));
    return (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
      id: 'candemor-setup-installs',
      mode: 'readwrite',
      startIn: 'downloads',
    });
  }

  async ensureWritePermission(handle: SetupDirectoryHandle): Promise<boolean> {
    const options = { mode: 'readwrite' as const };
    if (!handle.queryPermission || !handle.requestPermission) return true;
    if ((await handle.queryPermission(options)) === 'granted') return true;
    return (await handle.requestPermission(options)) === 'granted';
  }

  async getSavedDirectory(accountId: string): Promise<SetupDirectoryHandle | null> {
    if (!this.isSupported() || !accountId) return null;
    const database = await openDatabase();
    try {
      return await new Promise<SetupDirectoryHandle | null>((resolve, reject) => {
        const request = database
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .get(directoryKey(accountId));
        request.onsuccess = () =>
          resolve((request.result as SetupDirectoryHandle | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }

  async saveDirectory(accountId: string, handle: SetupDirectoryHandle): Promise<void> {
    if (!this.isSupported() || !accountId) return;
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const request = database
          .transaction(STORE_NAME, 'readwrite')
          .objectStore(STORE_NAME)
          .put(handle, directoryKey(accountId));
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }

  async forgetDirectory(accountId: string): Promise<void> {
    if (!this.isSupported() || !accountId) return;
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const request = database
          .transaction(STORE_NAME, 'readwrite')
          .objectStore(STORE_NAME)
          .delete(directoryKey(accountId));
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }

  async writeFile(handle: SetupDirectoryHandle, name: string, contents: Blob): Promise<void> {
    const fileHandle = await handle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(contents);
      await writable.close();
    } catch (error) {
      await writable.abort?.().catch(() => undefined);
      throw error;
    }
  }
}

function directoryKey(accountId: string): string {
  return `setup-install:${accountId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
