/**
 * Geography Image Manager - Handles converting drawing paths to/from PNG images
 * This approach is much more efficient and avoids coordinate transformation issues
 */

import type { DrawingPath } from '../types/mapTypes';

export interface GeographyImageData {
    imageDataUrl: string; // Base64 PNG data
    width: number;
    height: number;
    offsetX: number; // Position relative to hex grid
    offsetY: number;
    scale: number; // Scale factor for the image
}

export class GeographyImageManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor() {
        this.canvas = document.createElement('canvas');
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas 2D context');
        }
        this.ctx = ctx;
    }

    /**
     * Convert drawing paths to a PNG image
     */
    async pathsToImage(
        paths: DrawingPath[],
        canvasWidth: number,
        canvasHeight: number,
        backgroundColor: string = 'transparent'
    ): Promise<GeographyImageData> {
        // Set canvas size
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;

        // Clear canvas
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Set background if not transparent
        if (backgroundColor !== 'transparent') {
            this.ctx.fillStyle = backgroundColor;
            this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // Calculate bounds to center the drawing
        const bounds = this.calculatePathBounds(paths);
        if (!bounds) {
            // Empty paths - return blank image
            return {
                imageDataUrl: this.canvas.toDataURL('image/png'),
                width: canvasWidth,
                height: canvasHeight,
                offsetX: 0,
                offsetY: 0,
                scale: 1
            };
        }

        // Calculate offset to center the drawing
        const offsetX = (canvasWidth - bounds.width) / 2 - bounds.minX;
        const offsetY = (canvasHeight - bounds.height) / 2 - bounds.minY;

        // Draw all paths
        paths.forEach(path => {
            this.drawPath(path, offsetX, offsetY);
        });

        return {
            imageDataUrl: this.canvas.toDataURL('image/png'),
            width: canvasWidth,
            height: canvasHeight,
            offsetX: 0, // Image is already centered
            offsetY: 0,
            scale: 1
        };
    }

    /**
     * Draw a single path on the canvas
     */
    private drawPath(path: DrawingPath, offsetX: number, offsetY: number): void {
        if (path.points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.strokeStyle = path.color || '#000000';
        this.ctx.lineWidth = path.strokeWidth || 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Move to first point
        const firstPoint = path.points[0];
        this.ctx.moveTo(firstPoint.x + offsetX, firstPoint.y + offsetY);

        // Draw lines to all other points
        for (let i = 1; i < path.points.length; i++) {
            const point = path.points[i];
            this.ctx.lineTo(point.x + offsetX, point.y + offsetY);
        }

        this.ctx.stroke();
    }

    /**
     * Calculate bounding box of all paths
     */
    private calculatePathBounds(paths: DrawingPath[]): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        width: number;
        height: number;
    } | null {
        if (paths.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        paths.forEach(path => {
            path.points.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
        });

        if (minX === Infinity) return null;

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Create an image element from image data
     */
    async createImageElement(imageData: GeographyImageData): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageData.imageDataUrl;
        });
    }

    /**
     * Save geography image data to storage (file-based)
     */
    async saveGeographyImage(
        mapKey: string,
        imageData: GeographyImageData
    ): Promise<boolean> {
        try {
            // Convert base64 to blob
            const response = await fetch(imageData.imageDataUrl);
            const blob = await response.blob();

            // Create form data for server upload
            const formData = new FormData();
            formData.append('image', blob, `${mapKey}_geography.png`);
            formData.append('mapKey', mapKey);

            // Try server upload first
            try {
                const uploadResponse = await fetch('/api/upload/geography', {
                    method: 'POST',
                    body: formData
                });

                if (uploadResponse.ok) {
                    const result = await uploadResponse.json();
                    console.log(`[GeographyImageManager] Geography image saved to file for map: ${mapKey}`);

                    // Also save metadata to localStorage as backup
                    const storageKey = `geography_${mapKey}`;
                    localStorage.setItem(storageKey, JSON.stringify({
                        ...imageData,
                        fileUrl: result.url
                    }));

                    return true;
                }
            } catch (serverError) {
                console.warn('[GeographyImageManager] Server upload failed, using localStorage fallback:', serverError);
            }

            // Fallback to localStorage if server fails
            const storageKey = `geography_${mapKey}`;
            localStorage.setItem(storageKey, JSON.stringify(imageData));
            console.log(`[GeographyImageManager] Geography image saved to localStorage for map: ${mapKey}`);
            return true;

        } catch (error) {
            console.error('[GeographyImageManager] Failed to save geography image:', error);
            return false;
        }
    }

    /**
     * Load geography image data from storage (file-based with localStorage fallback)
     */
    async loadGeographyImage(mapKey: string): Promise<GeographyImageData | null> {
        try {
            // First try to load from file server
            try {
                const fileResponse = await fetch(`/api/geography/${mapKey}`);
                if (fileResponse.ok) {
                    const fileData = await fileResponse.json();
                    console.log(`[GeographyImageManager] Geography image loaded from file for map: ${mapKey}`);
                    return fileData;
                }
            } catch (fileError) {
                console.log(`[GeographyImageManager] File server not available, trying localStorage for map: ${mapKey}`);
            }

            // Fallback to localStorage
            const storageKey = `geography_${mapKey}`;
            const data = localStorage.getItem(storageKey);
            if (!data) {
                console.log(`[GeographyImageManager] No geography data found for map: ${mapKey}`);
                return null;
            }

            const imageData = JSON.parse(data) as GeographyImageData;
            console.log(`[GeographyImageManager] Geography image loaded from localStorage for map: ${mapKey}`);
            return imageData;
        } catch (error) {
            console.error('[GeographyImageManager] Failed to load geography image:', error);
            return null;
        }
    }

    /**
     * Delete geography image from storage
     */
    async deleteGeographyImage(mapKey: string): Promise<boolean> {
        try {
            const storageKey = `geography_${mapKey}`;
            localStorage.removeItem(storageKey);
            console.log(`[GeographyImageManager] Geography image deleted for map: ${mapKey}`);
            return true;
        } catch (error) {
            console.error('[GeographyImageManager] Failed to delete geography image:', error);
            return false;
        }
    }
}
