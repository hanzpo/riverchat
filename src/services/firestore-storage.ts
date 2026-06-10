import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AuthService } from './auth';
import { CacheService } from './cache';
import type { River, Settings, RiverChatData } from '../types';

const STORAGE_KEY = 'riverchat_data';

const DEFAULT_SETTINGS: Settings = {
  lastUsedModelId: null,
  selectedModelIds: [],
  lastModelRefresh: undefined,
};

/**
 * Firestore-based storage service that syncs data across devices.
 * Falls back to localStorage for unauthenticated users.
 */
export class FirestoreStorageService {
  static async getRivers(useCache: boolean = true): Promise<River[]> {
    const user = await AuthService.getCurrentUserAsync();

    if (!user) {
      return this.getLocalRivers();
    }

    if (useCache) {
      const cached = CacheService.getCachedRiversMetadata();
      if (cached) {
        // The cache stores lightweight metadata without node data; rehydrate
        // to the River shape with empty nodes so callers get a valid River[].
        // Full node data is loaded per-river via getRiver().
        return cached.map(({ nodeCount: _nodeCount, ...meta }) => ({ ...meta, nodes: {} }));
      }
    }

    try {
      const riversRef = collection(db, 'users', user.uid, 'rivers');
      const snapshot = await getDocs(riversRef);

      const rivers: River[] = [];
      snapshot.forEach((doc) => {
        rivers.push(doc.data() as River);
      });

      const sortedRivers = rivers.sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );

      CacheService.cacheRiversMetadata(sortedRivers);
      return sortedRivers;
    } catch (error) {
      console.error('Error fetching rivers from Firestore:', error);
      return this.getLocalRivers();
    }
  }

  static async getRiver(id: string): Promise<River | null> {
    const user = await AuthService.getCurrentUserAsync();

    if (!user) {
      return this.getLocalRiver(id);
    }

    try {
      const riverRef = doc(db, 'users', user.uid, 'rivers', id);
      const riverSnap = await getDoc(riverRef);

      if (riverSnap.exists()) {
        return riverSnap.data() as River;
      }
      return null;
    } catch (error) {
      console.error('Error fetching river from Firestore:', error);
      return this.getLocalRiver(id);
    }
  }

  static async saveRiver(river: River): Promise<void> {
    const user = await AuthService.getCurrentUserAsync();
    river.lastModified = new Date().toISOString();

    if (!user) {
      this.saveLocalRiver(river);
      return;
    }

    try {
      const riverRef = doc(db, 'users', user.uid, 'rivers', river.id);
      await setDoc(riverRef, {
        ...river,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error saving river to Firestore:', error);
      this.saveLocalRiver(river);
    } finally {
      // The rivers list changed — drop stale cached metadata
      CacheService.clearRiversMetadata();
    }
  }

  static async deleteRiver(id: string): Promise<void> {
    const user = await AuthService.getCurrentUserAsync();

    if (!user) {
      this.deleteLocalRiver(id);
      return;
    }

    try {
      const riverRef = doc(db, 'users', user.uid, 'rivers', id);
      await deleteDoc(riverRef);
    } catch (error) {
      console.error('Error deleting river from Firestore:', error);
      this.deleteLocalRiver(id);
    } finally {
      // The rivers list changed — drop stale cached metadata
      CacheService.clearRiversMetadata();
    }
  }

  static async getSettings(useCache: boolean = true): Promise<Settings> {
    const user = await AuthService.getCurrentUserAsync();

    if (!user) {
      return this.getLocalSettings();
    }

    if (useCache) {
      const cached = CacheService.getCachedSettings();
      if (cached) {
        return cached;
      }
    }

    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const data = settingsSnap.data();

        // Migrate from old format if needed
        const settings: Settings = {
          lastUsedModelId: data.lastUsedModelId || data.lastUsedModel?.id || null,
          selectedModelIds:
            data.selectedModelIds ||
            data.lastChatSelectedModels?.map((m: { id: string }) => m.id) ||
            [],
          lastModelRefresh: data.lastModelRefresh,
          lastVisitedRiverId: data.lastVisitedRiverId || null,
          dismissedTips: data.dismissedTips || [],
          messageCount: data.messageCount || 0,
          sessionCount: data.sessionCount || 0,
          firstVisitTimestamp: data.firstVisitTimestamp,
        };

        CacheService.cacheSettings(settings);
        return settings;
      }

      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error fetching settings from Firestore:', error);
      return this.getLocalSettings();
    }
  }

  static async saveSettings(settings: Settings): Promise<void> {
    const user = await AuthService.getCurrentUserAsync();

    if (!user) {
      this.saveLocalSettings(settings);
      return;
    }

    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      await setDoc(settingsRef, {
        lastUsedModelId: settings.lastUsedModelId,
        selectedModelIds: settings.selectedModelIds || [],
        lastModelRefresh: settings.lastModelRefresh,
        lastVisitedRiverId: settings.lastVisitedRiverId || null,
        dismissedTips: settings.dismissedTips || [],
        messageCount: settings.messageCount || 0,
        sessionCount: settings.sessionCount || 0,
        firstVisitTimestamp: settings.firstVisitTimestamp || null,
        updatedAt: serverTimestamp(),
      });

      CacheService.cacheSettings(settings);
    } catch (error) {
      console.error('Error saving settings to Firestore:', error);
      this.saveLocalSettings(settings);
    }
  }

  /**
   * Migrate data from localStorage to Firestore.
   */
  static async migrateLocalDataToFirestore(): Promise<void> {
    const user = await AuthService.getCurrentUserAsync();
    if (!user) return;

    try {
      const localData = this.getLocalData();
      if (!localData.rivers.length) return;

      const batch = writeBatch(db);
      let hasBatchOperations = false;

      for (const river of localData.rivers) {
        const riverRef = doc(db, 'users', user.uid, 'rivers', river.id);
        const existingRiver = await getDoc(riverRef);

        if (!existingRiver.exists()) {
          batch.set(riverRef, { ...river, migratedAt: serverTimestamp() });
          hasBatchOperations = true;
        }
      }

      if (hasBatchOperations) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Error migrating data to Firestore:', error);
    }
  }

  // ============ LocalStorage Fallback Methods ============

  private static getLocalData(): RiverChatData {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return { rivers: [], settings: DEFAULT_SETTINGS, activeRiverId: null };
      }
      return JSON.parse(data) as RiverChatData;
    } catch (error) {
      // Graceful fallback, but surface the cause (quota, corrupted JSON, ...)
      console.warn(
        '[FirestoreStorage] Failed to read local data; falling back to empty state:',
        error
      );
      return { rivers: [], settings: DEFAULT_SETTINGS, activeRiverId: null };
    }
  }

  private static saveLocalData(data: RiverChatData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }

  private static getLocalRivers(): River[] {
    return this.getLocalData().rivers;
  }

  private static getLocalRiver(id: string): River | null {
    return this.getLocalData().rivers.find((river) => river.id === id) || null;
  }

  private static saveLocalRiver(river: River): void {
    const data = this.getLocalData();
    const index = data.rivers.findIndex((r) => r.id === river.id);
    if (index >= 0) {
      data.rivers[index] = river;
    } else {
      data.rivers.push(river);
    }
    this.saveLocalData(data);
  }

  private static deleteLocalRiver(id: string): void {
    const data = this.getLocalData();
    data.rivers = data.rivers.filter((river) => river.id !== id);
    if (data.activeRiverId === id) {
      data.activeRiverId = null;
    }
    this.saveLocalData(data);
  }

  private static getLocalSettings(): Settings {
    const data = this.getLocalData();
    const raw = data.settings || DEFAULT_SETTINGS;
    // Migrate from old format if needed
    return {
      lastUsedModelId: raw.lastUsedModelId || (raw as any).lastUsedModel?.id || null,
      selectedModelIds:
        raw.selectedModelIds ||
        (raw as any).lastChatSelectedModels?.map((m: { id: string }) => m.id) ||
        [],
      lastModelRefresh: raw.lastModelRefresh,
      lastVisitedRiverId: raw.lastVisitedRiverId || null,
      dismissedTips: raw.dismissedTips || [],
      messageCount: raw.messageCount || 0,
      sessionCount: raw.sessionCount || 0,
      firstVisitTimestamp: raw.firstVisitTimestamp,
    };
  }

  private static saveLocalSettings(settings: Settings): void {
    const data = this.getLocalData();
    data.settings = settings;
    this.saveLocalData(data);
  }

  static clearLocalData(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
