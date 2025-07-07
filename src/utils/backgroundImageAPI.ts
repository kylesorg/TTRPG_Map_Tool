// Map data management API utilities
export interface BackgroundImageUploadResult {
  success: boolean;
  url: string;
  filename: string;
  mapKey: string;
  originalName: string;
  size: number;
}

export interface BackgroundImageInfo {
  success: boolean;
  url: string;
  filename: string;
}

export interface MapDataSaveResult {
  success: boolean;
  message: string;
  mapKey: string;
  filename: string;
}

export interface MapDataLoadResult {
  success: boolean;
  mapKey: string;
  mapData: any;
}

export interface MapListResult {
  success: boolean;
  maps: Array<{
    mapKey: string;
    directory: string;
    hasMapData: boolean;
    name?: string;
    createdAt?: Date;
    lastModified?: Date;
  }>;
}

export interface StickerInfo {
  filename: string;
  stickerName: string;
  number: number;
  extension: string;
  url: string;
  size: number;
}

export interface StickerListResult {
  success: boolean;
  mapKey: string;
  stickers: StickerInfo[];
  stickerGroups: Record<string, StickerInfo[]>;
  totalCount: number;
}

export interface StickerRenameResult {
  success: boolean;
  message: string;
  oldName: string;
  newName: string;
  filesRenamed: number;
}

export interface StickerDeleteResult {
  success: boolean;
  message: string;
  deletedCount: number;
}

export class BackgroundImageAPI {
  /**
   * Upload a background image for a specific map
   */
  static async uploadBackgroundImage(
    file: File,
    mapKey: string,
    uploadType: 'worldmap' | 'townmap' | 'sticker' = 'worldmap',
    townCoords?: string,
    stickerName?: string
  ): Promise<BackgroundImageUploadResult> {
    // First, try server upload
    try {
      const formData = new FormData();
      formData.append('backgroundImage', file);
      formData.append('mapId', mapKey);
      formData.append('uploadType', uploadType);

      if (townCoords) {
        formData.append('townCoords', townCoords);
      }

      if (stickerName) {
        formData.append('stickerName', stickerName);
      }

      const response = await fetch('/api/upload/background', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server upload failed, falling back to blob URL:', error);
    }

    // Fallback to blob URL for local development
    console.log('🔄 [BackgroundImageAPI] Using local blob URL for development mode');
    const blobUrl = URL.createObjectURL(file);

    return {
      success: true,
      url: blobUrl,
      filename: file.name,
      mapKey: mapKey,
      originalName: file.name,
      size: file.size
    };
  }

  /**
   * Get background image info for a specific map
   */
  static async getBackgroundImage(mapKey: string): Promise<BackgroundImageInfo> {
    try {
      const response = await fetch(`/api/upload/background/${mapKey}`);

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server get background failed, no persistent storage available:', error);
    }

    // Return empty result for local development
    return {
      success: false,
      url: '',
      filename: ''
    };
  }

  /**
   * Delete background image for a specific map
   */
  static async deleteBackgroundImage(mapKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`/api/upload/background/${mapKey}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server delete failed, blob URLs are automatically cleaned up:', error);
    }

    // For local development, blob URLs are cleaned up automatically
    return {
      success: true,
      message: 'Background removed (local mode)'
    };
  }

  /**
   * Save map data to the server
   */
  static async saveMapData(mapKey: string, mapData: any): Promise<MapDataSaveResult> {
    try {
      const formData = new FormData();
      formData.append('mapKey', mapKey);
      formData.append('mapData', JSON.stringify(mapData));

      const response = await fetch('/api/map/save', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server save map data failed:', error);
    }

    return {
      success: false,
      message: 'Failed to save map data',
      mapKey: mapKey,
      filename: ''
    };
  }

  /**
   * Load map data from the server
   */
  static async loadMapData(mapKey: string, suppressNotFoundWarning = false): Promise<MapDataLoadResult> {
    try {
      const response = await fetch(`/api/map/load/${mapKey}`);

      if (response.ok) {
        return response.json();
      } else if (response.status === 404 && suppressNotFoundWarning) {
        // Expected 404 for key existence check - don't log as error
        return {
          success: false,
          mapKey: mapKey,
          mapData: null
        };
      }
    } catch (error) {
      if (!suppressNotFoundWarning) {
        console.log('[BackgroundImageAPI] Server load map data failed:', error);
      }
    }

    return {
      success: false,
      mapKey: mapKey,
      mapData: null
    };
  }

  /**
   * List all available maps
   */
  static async listMaps(): Promise<MapListResult> {
    try {
      const response = await fetch('/api/map/list');

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server list maps failed:', error);
    }

    return {
      success: false,
      maps: []
    };
  }

  /**
   * Generate a unique map key
   */
  static generateMapKey(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if upload server is available
   */
  static async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List all stickers for a specific map
   */
  static async listStickers(mapKey: string): Promise<StickerListResult> {
    try {
      const response = await fetch(`/api/stickers/${mapKey}`);

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server list stickers failed:', error);
    }

    // Return empty result for local development
    return {
      success: false,
      mapKey: mapKey,
      stickers: [],
      stickerGroups: {},
      totalCount: 0
    };
  }

  /**
   * Rename all stickers with a given name
   */
  static async renameStickerGroup(mapKey: string, oldName: string, newName: string): Promise<StickerRenameResult> {
    try {
      const response = await fetch(`/api/stickers/${mapKey}/${oldName}/${newName}`, {
        method: 'PUT'
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server rename sticker failed:', error);
    }

    // Return failure for local development
    return {
      success: false,
      message: 'Rename not available in local development mode',
      oldName: oldName,
      newName: newName,
      filesRenamed: 0
    };
  }

  /**
   * Delete a specific sticker or all stickers with a given name
   */
  static async deleteSticker(mapKey: string, stickerName: string, stickerNumber?: number): Promise<StickerDeleteResult> {
    try {
      let url = `/api/stickers/${mapKey}/${stickerName}`;
      if (stickerNumber !== undefined) {
        url += `/${stickerNumber}`;
      }

      const response = await fetch(url, {
        method: 'DELETE'
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.log('[BackgroundImageAPI] Server delete sticker failed:', error);
    }

    // Return failure for local development
    return {
      success: false,
      message: 'Delete not available in local development mode',
      deletedCount: 0
    };
  }

  /**
   * Check if a map key exists without loading the full data
   */
  static async checkMapExists(mapKey: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/map/check/${mapKey}`);

      if (response.ok) {
        const result = await response.json();
        return result.exists;
      }
    } catch (error) {
      // Silently fail - assume doesn't exist
    }

    return false;
  }
}
