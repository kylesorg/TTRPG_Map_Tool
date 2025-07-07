import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import formidable, { type Part } from 'formidable'

// Upload plugin that handles file uploads directly in Vite
function uploadPlugin(): Plugin {
  return {
    name: 'upload-plugin',
    configureServer(server) {
      // Base uploads directory - will contain map_data/map_{mapKey}/ subdirectories
      const baseUploadsDir = path.join(process.cwd(), 'public', 'map_data')
      if (!fs.existsSync(baseUploadsDir)) {
        fs.mkdirSync(baseUploadsDir, { recursive: true })
      }

      console.log('\n🗺️  World Map RPG Tool - Map Data Management Ready')
      console.log('📁 Base directory:', baseUploadsDir)
      console.log('📂 Maps will be stored in: map_data/map_{mapKey}/')
      console.log('───────────────────────────────────────────────────────\n')

      // Helper function to ensure map directory exists
      const ensureMapDirectory = (mapKey: string): string => {
        const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)
        if (!fs.existsSync(mapDir)) {
          fs.mkdirSync(mapDir, { recursive: true })
        }
        return mapDir
      }

      server.middlewares.use('/api/upload/background', async (req, res, next) => {
        if (req.method === 'POST') {
          try {
            const form = formidable({
              uploadDir: baseUploadsDir, // Temporary upload location
              keepExtensions: true,
              maxFileSize: 50 * 1024 * 1024, // 50MB
              filter: (part: Part) => {
                return part.mimetype?.startsWith('image/') || false
              }
            })

            const [fields, files] = await form.parse(req)
            const uploadedFile = Array.isArray(files.backgroundImage) ? files.backgroundImage[0] : files.backgroundImage
            const mapKey = Array.isArray(fields.mapId) ? fields.mapId[0] : fields.mapId || 'default'
            const uploadType = Array.isArray(fields.uploadType) ? fields.uploadType[0] : fields.uploadType || 'worldmap'
            const townCoords = Array.isArray(fields.townCoords) ? fields.townCoords[0] : fields.townCoords || '0_0'
            const stickerName = Array.isArray(fields.stickerName) ? fields.stickerName[0] : fields.stickerName || 'sticker'

            if (!uploadedFile) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No file uploaded' }))
              return
            }

            // Ensure map directory exists
            const mapDir = ensureMapDirectory(mapKey)

            // Generate proper filename based on type  
            const originalName = uploadedFile.originalFilename || 'image'
            const fileExtension = path.extname(originalName)

            let finalFilename: string
            let searchPattern: string | null = null // Pattern to find old files to remove

            if (uploadType === 'worldmap') {
              finalFilename = `${mapKey}_WorldHexMap_background${fileExtension}`
              searchPattern = `${mapKey}_WorldHexMap_background`
            } else if (uploadType === 'townmap') {
              finalFilename = `${mapKey}_TownMap_${townCoords}_background${fileExtension}`
              searchPattern = `${mapKey}_TownMap_${townCoords}_background`
            } else if (uploadType === 'sticker') {
              // For stickers, find the next available number (global, not per town)
              const existingFiles = fs.readdirSync(mapDir)
              const stickerFiles = existingFiles.filter(file =>
                file.startsWith(`${mapKey}_Sticker_${stickerName}_`) &&
                file.includes('.') && !file.includes('_background')
              )

              // Find the highest number and increment
              let nextNumber = 1
              stickerFiles.forEach(file => {
                const match = file.match(new RegExp(`${mapKey}_Sticker_${stickerName}_(\\d+)\\.`))
                if (match) {
                  const num = parseInt(match[1], 10)
                  if (num >= nextNumber) {
                    nextNumber = num + 1
                  }
                }
              })

              finalFilename = `${mapKey}_Sticker_${stickerName}_${nextNumber}${fileExtension}`
              searchPattern = null // Don't remove old stickers, they can coexist
            } else {
              // Legacy support - default to world map background
              finalFilename = `${mapKey}_WorldHexMap_background${fileExtension}`
              searchPattern = `${mapKey}_WorldHexMap_background`
            }

            const finalPath = path.join(mapDir, finalFilename)

            // Remove any existing background files for this map type to avoid duplicates
            if (searchPattern) {
              try {
                const existingFiles = fs.readdirSync(mapDir)
                for (const file of existingFiles) {
                  if (file.includes(searchPattern) && file !== finalFilename) {
                    fs.unlinkSync(path.join(mapDir, file))
                    console.log(`🗑️  Removed old background file: ${file}`)
                  }
                }
              } catch (cleanupError) {
                console.warn('⚠️  Could not clean up old background files:', cleanupError)
              }
            }

            // Move file to final location with proper name
            fs.renameSync(uploadedFile.filepath, finalPath)

            const response = {
              success: true,
              url: `/map_data/map_${mapKey}/${finalFilename}`,
              filename: finalFilename,
              mapKey: mapKey,
              originalName: originalName,
              size: uploadedFile.size
            }

            console.log('✅ Background image uploaded successfully:', finalFilename)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(response))
          } catch (error) {
            console.error('❌ Upload error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Upload failed: ' + (error as Error).message }))
          }
        } else if (req.method === 'GET') {
          // Handle GET requests for specific maps
          const urlParts = req.url?.split('/') || []
          const mapKey = urlParts[urlParts.length - 1]

          try {
            const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)

            if (!fs.existsSync(mapDir)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No map directory found for this key' }))
              return
            }

            const files = fs.readdirSync(mapDir)
            const backgroundFile = files.find(file => file.includes('_WorldHexMap_background'))

            if (backgroundFile) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                url: `/map_data/map_${mapKey}/${backgroundFile}`,
                filename: backgroundFile
              }))
            } else {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No background image found for this map' }))
            }
          } catch (error) {
            console.error('❌ Get background error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to get background image' }))
          }
        } else if (req.method === 'DELETE') {
          // Handle DELETE requests
          const urlParts = req.url?.split('/') || []
          const mapKey = urlParts[urlParts.length - 1]

          try {
            const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)

            if (!fs.existsSync(mapDir)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No map directory found for this key' }))
              return
            }

            const files = fs.readdirSync(mapDir)
            const backgroundFile = files.find(file => file.includes('_WorldHexMap_background'))

            if (backgroundFile) {
              fs.unlinkSync(path.join(mapDir, backgroundFile))
              console.log('🗑️ Background image deleted:', backgroundFile)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, message: 'Background image deleted' }))
            } else {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No background image found for this map' }))
            }
          } catch (error) {
            console.error('❌ Delete background error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to delete background image' }))
          }
        } else {
          next()
        }
      })

      // Sticker management endpoints
      server.middlewares.use('/api/stickers', async (req, res, next) => {
        if (req.method === 'GET') {
          // List all stickers for a map: /api/stickers/{mapKey}
          const urlParts = req.url?.split('/') || []
          const mapKey = urlParts[urlParts.length - 1]

          try {
            const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)

            if (!fs.existsSync(mapDir)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No map directory found for this key' }))
              return
            }

            const files = fs.readdirSync(mapDir)
            const stickerFiles = files.filter(file =>
              file.startsWith(`${mapKey}_Sticker_`) &&
              !file.includes('_background') &&
              file.includes('.')
            )

            // Parse sticker info from filenames
            const stickers = stickerFiles.map(file => {
              const match = file.match(new RegExp(`${mapKey}_Sticker_(.+)_(\\d+)\\.(\\w+)$`))
              if (match) {
                const [, stickerName, number, extension] = match
                return {
                  filename: file,
                  stickerName: stickerName,
                  number: parseInt(number, 10),
                  extension: extension,
                  url: `/map_data/map_${mapKey}/${file}`,
                  size: fs.statSync(path.join(mapDir, file)).size
                }
              }
              return null
            }).filter(Boolean)

            // Group by sticker name for easier UI handling
            const stickerGroups: Record<string, any[]> = {}
            stickers.forEach(sticker => {
              if (!stickerGroups[sticker!.stickerName]) {
                stickerGroups[sticker!.stickerName] = []
              }
              stickerGroups[sticker!.stickerName].push(sticker)
            })

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              mapKey: mapKey,
              stickers: stickers,
              stickerGroups: stickerGroups,
              totalCount: stickers.length
            }))
          } catch (error) {
            console.error('❌ List stickers error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to list stickers' }))
          }
        } else if (req.method === 'PUT') {
          // Rename sticker: /api/stickers/{mapKey}/{oldName}/{newName}
          const urlParts = req.url?.split('/') || []
          const mapKey = urlParts[3]
          const oldName = urlParts[4]
          const newName = urlParts[5]

          if (!mapKey || !oldName || !newName) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing mapKey, oldName, or newName' }))
            return
          }

          try {
            const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)

            if (!fs.existsSync(mapDir)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No map directory found for this key' }))
              return
            }

            const files = fs.readdirSync(mapDir)
            const stickerFiles = files.filter(file =>
              file.startsWith(`${mapKey}_Sticker_${oldName}_`)
            )

            let renamedCount = 0
            for (const file of stickerFiles) {
              const newFileName = file.replace(`${mapKey}_Sticker_${oldName}_`, `${mapKey}_Sticker_${newName}_`)
              const oldPath = path.join(mapDir, file)
              const newPath = path.join(mapDir, newFileName)

              fs.renameSync(oldPath, newPath)
              renamedCount++
              console.log(`📝 Renamed sticker: ${file} → ${newFileName}`)
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              message: `Renamed ${renamedCount} sticker files`,
              oldName: oldName,
              newName: newName,
              filesRenamed: renamedCount
            }))
          } catch (error) {
            console.error('❌ Rename sticker error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to rename sticker' }))
          }
        } else if (req.method === 'DELETE') {
          // Delete specific sticker or all stickers with a name: /api/stickers/{mapKey}/{stickerName}[/{number}]
          const urlParts = req.url?.split('/') || []
          const mapKey = urlParts[3]
          const stickerName = urlParts[4]
          const stickerNumber = urlParts[5] ? parseInt(urlParts[5], 10) : null

          if (!mapKey || !stickerName) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing mapKey or stickerName' }))
            return
          }

          try {
            const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)

            if (!fs.existsSync(mapDir)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No map directory found for this key' }))
              return
            }

            const files = fs.readdirSync(mapDir)
            let filesToDelete: string[]

            if (stickerNumber !== null) {
              // Delete specific numbered sticker
              filesToDelete = files.filter(file =>
                file.startsWith(`${mapKey}_Sticker_${stickerName}_${stickerNumber}.`)
              )
            } else {
              // Delete all stickers with this name
              filesToDelete = files.filter(file =>
                file.startsWith(`${mapKey}_Sticker_${stickerName}_`)
              )
            }

            let deletedCount = 0
            for (const file of filesToDelete) {
              fs.unlinkSync(path.join(mapDir, file))
              deletedCount++
              console.log(`🗑️ Deleted sticker: ${file}`)
            }

            if (deletedCount > 0) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                message: `Deleted ${deletedCount} sticker files`,
                deletedCount: deletedCount
              }))
            } else {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No matching stickers found to delete' }))
            }
          } catch (error) {
            console.error('❌ Delete sticker error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to delete sticker' }))
          }
        } else {
          next()
        }
      })

      // Map data endpoints
      server.middlewares.use('/api/map/save', async (req, res, next) => {
        if (req.method === 'POST') {
          try {
            const form = formidable({
              maxFileSize: 10 * 1024 * 1024, // 10MB for JSON data
              maxFieldsSize: 50 * 1024 * 1024, // 50MB for form fields (to handle large JSON data)
            })

            const [fields] = await form.parse(req)
            const mapKey = Array.isArray(fields.mapKey) ? fields.mapKey[0] : fields.mapKey
            const mapData = Array.isArray(fields.mapData) ? fields.mapData[0] : fields.mapData

            if (!mapKey || !mapData) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing mapKey or mapData' }))
              return
            }

            // Ensure map directory exists
            const mapDir = ensureMapDirectory(mapKey)

            // Save map data as JSON
            const mapDataFilename = `${mapKey}_Map_Info.json`
            const mapDataPath = path.join(mapDir, mapDataFilename)

            fs.writeFileSync(mapDataPath, mapData, 'utf8')

            console.log('💾 Map data saved:', mapDataFilename)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              message: 'Map data saved successfully',
              mapKey: mapKey,
              filename: mapDataFilename
            }))
          } catch (error) {
            console.error('❌ Save map data error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to save map data: ' + (error as Error).message }))
          }
        } else {
          next()
        }
      })

      // Map existence check endpoint - lightweight check without loading full data
      server.middlewares.use('/api/map/check', async (req, res, next) => {
        if (req.method === 'GET') {
          const urlParts = req.url?.split('/') || []
          const mapKey = urlParts[urlParts.length - 1]

          try {
            const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)
            const mapDataFilename = `${mapKey}_Map_Info.json`
            const mapDataPath = path.join(mapDir, mapDataFilename)

            const exists = fs.existsSync(mapDataPath)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              exists: exists,
              mapKey: mapKey
            }))
          } catch (error) {
            res.statusCode = 200 // Don't return error for existence check
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              exists: false,
              mapKey: mapKey
            }))
          }
        } else {
          next()
        }
      })

      server.middlewares.use('/api/map/load', async (req, res, next) => {
        if (req.method === 'GET') {
          const urlParts = req.url?.split('/') || []
          const mapKey = urlParts[urlParts.length - 1]

          try {
            const mapDir = path.join(baseUploadsDir, `map_${mapKey}`)

            if (!fs.existsSync(mapDir)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No map found for this key' }))
              return
            }

            const mapDataFilename = `${mapKey}_Map_Info.json`
            const mapDataPath = path.join(mapDir, mapDataFilename)

            if (fs.existsSync(mapDataPath)) {
              const mapData = fs.readFileSync(mapDataPath, 'utf8')
              console.log('📖 Map data loaded:', mapDataFilename)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                mapKey: mapKey,
                mapData: JSON.parse(mapData)
              }))
            } else {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No map data found for this key' }))
            }
          } catch (error) {
            console.error('❌ Load map data error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to load map data: ' + (error as Error).message }))
          }
        } else {
          next()
        }
      })

      server.middlewares.use('/api/map/list', async (req, res, next) => {
        if (req.method === 'GET') {
          try {
            const mapDirs = fs.readdirSync(baseUploadsDir, { withFileTypes: true })
              .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('map_'))
              .map(dirent => {
                const mapKey = dirent.name.replace('map_', '')
                const mapDir = path.join(baseUploadsDir, dirent.name)
                const mapDataPath = path.join(mapDir, `${mapKey}_Map_Info.json`)

                let mapInfo = null
                if (fs.existsSync(mapDataPath)) {
                  try {
                    const mapData = JSON.parse(fs.readFileSync(mapDataPath, 'utf8'))
                    mapInfo = {
                      name: mapData.worldMap?.name || 'Unnamed Map',
                      createdAt: fs.statSync(mapDataPath).birthtime,
                      lastModified: fs.statSync(mapDataPath).mtime
                    }
                  } catch (error) {
                    console.error('Error reading map info for', mapKey, error)
                  }
                }

                return {
                  mapKey: mapKey,
                  directory: dirent.name,
                  hasMapData: fs.existsSync(mapDataPath),
                  ...mapInfo
                }
              })

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              maps: mapDirs
            }))
          } catch (error) {
            console.error('❌ List maps error:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to list maps: ' + (error as Error).message }))
          }
        } else {
          next()
        }
      })

      server.middlewares.use('/api/health', (_req, res) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          status: 'OK',
          mode: 'vite-development',
          timestamp: new Date().toISOString()
        }))
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), uploadPlugin()],
})
