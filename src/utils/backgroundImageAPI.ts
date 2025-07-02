// Background image API utilities
export interface BackgroundImageUploadResult {
  success: boolean;
  url: string;
  filename: string;
  mapId: string;
  originalName: string;
  size: number;
}

export interface BackgroundImageInfo {
  success: boolean;
  url: string;
  filename: string;
}

export class BackgroundImageAPI {
  /**
   * Upload a background image for a specific map
   */
  static async uploadBackgroundImage(file: File, mapId: string): Promise<BackgroundImageUploadResult> {
    const formData = new FormData();
    formData.append('backgroundImage', file);
    formData.append('mapId', mapId);

    const response = await fetch('/api/upload/background', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get background image info for a specific map
   */
  static async getBackgroundImage(mapId: string): Promise<BackgroundImageInfo> {
    const response = await fetch(`/api/upload/background/${mapId}`);

    if (!response.ok) {
      throw new Error(`Get background failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete background image for a specific map
   */
  static async deleteBackgroundImage(mapId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/upload/background/${mapId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate a unique map ID
   */
  static generateMapId(): string {
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
}
