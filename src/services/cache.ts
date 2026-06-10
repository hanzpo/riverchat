/**
 * Cache service for optimizing app performance
 * Stores frequently accessed data in localStorage with expiration
 */

import type { User } from 'firebase/auth';
import type { UserProfile } from './auth';
import type { River, RiverMetadata, Settings } from '../types';

const CACHE_KEYS = {
  AUTH_STATE: 'riverchat_auth_cache',
  USER_PROFILE: 'riverchat_user_profile_cache',
  SETTINGS: 'riverchat_settings_cache',
  RIVERS_METADATA: 'riverchat_rivers_metadata_cache',
} as const;

// Cache expiration times (in milliseconds)
const CACHE_TTL = {
  AUTH_STATE: 7 * 24 * 60 * 60 * 1000, // 7 days
  USER_PROFILE: 24 * 60 * 60 * 1000, // 24 hours
  SETTINGS: 5 * 60 * 1000, // 5 minutes (frequent updates)
  RIVERS_METADATA: 10 * 60 * 1000, // 10 minutes
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface AuthStateCache {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export class CacheService {
  /**
   * Generic cache getter
   */
  private static getCache<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`Error reading cache for ${key}:`, error);
      return null;
    }
  }

  /**
   * Generic cache setter
   */
  private static setCache<T>(key: string, data: T, ttl: number): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error(`Error writing cache for ${key}:`, error);
    }
  }

  /**
   * Cache auth state for quick app startup
   */
  static cacheAuthState(user: User): void {
    const authState: AuthStateCache = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    };
    this.setCache(CACHE_KEYS.AUTH_STATE, authState, CACHE_TTL.AUTH_STATE);
  }

  /**
   * Get cached auth state
   */
  static getCachedAuthState(): AuthStateCache | null {
    return this.getCache<AuthStateCache>(CACHE_KEYS.AUTH_STATE);
  }

  /**
   * Clear auth state cache (on logout)
   */
  static clearAuthState(): void {
    localStorage.removeItem(CACHE_KEYS.AUTH_STATE);
  }

  /**
   * Cache user profile
   */
  static cacheUserProfile(profile: UserProfile): void {
    this.setCache(CACHE_KEYS.USER_PROFILE, profile, CACHE_TTL.USER_PROFILE);
  }

  /**
   * Get cached user profile
   */
  static getCachedUserProfile(): UserProfile | null {
    return this.getCache<UserProfile>(CACHE_KEYS.USER_PROFILE);
  }

  /**
   * Clear user profile cache
   */
  static clearUserProfile(): void {
    localStorage.removeItem(CACHE_KEYS.USER_PROFILE);
  }

  /**
   * Cache settings
   */
  static cacheSettings(settings: Settings): void {
    this.setCache(CACHE_KEYS.SETTINGS, settings, CACHE_TTL.SETTINGS);
  }

  /**
   * Get cached settings
   */
  static getCachedSettings(): Settings | null {
    return this.getCache<Settings>(CACHE_KEYS.SETTINGS);
  }

  /**
   * Clear settings cache (when manually saving)
   */
  static clearSettings(): void {
    localStorage.removeItem(CACHE_KEYS.SETTINGS);
  }

  /**
   * Cache rivers metadata (list of rivers without full node data)
   */
  static cacheRiversMetadata(rivers: River[]): void {
    // Store only metadata (id, name, dates) not full nodes
    const metadata: RiverMetadata[] = rivers.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      lastModified: r.lastModified,
      rootNodeId: r.rootNodeId,
      nodeCount: Object.keys(r.nodes || {}).length,
    }));
    this.setCache(CACHE_KEYS.RIVERS_METADATA, metadata, CACHE_TTL.RIVERS_METADATA);
  }

  /**
   * Get cached rivers metadata
   */
  static getCachedRiversMetadata(): RiverMetadata[] | null {
    return this.getCache<RiverMetadata[]>(CACHE_KEYS.RIVERS_METADATA);
  }

  /**
   * Clear rivers metadata cache (when rivers are modified)
   */
  static clearRiversMetadata(): void {
    localStorage.removeItem(CACHE_KEYS.RIVERS_METADATA);
  }

  /**
   * Clear all caches
   */
  static clearAll(): void {
    Object.values(CACHE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  }
}
