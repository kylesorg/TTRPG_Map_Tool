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
      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'backgrounds')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      console.log('\n🗺️  World Map RPG Tool - Background Images Ready')
      console.log('📁 Upload directory:', uploadsDir)
      console.log('───────────────────────────────────────────────────────\n')

      server.middlewares.use('/api/upload/background', async (req, res, next) => {
        if (req.method === 'POST') {
          try {
            const form = formidable({
              uploadDir: uploadsDir,
              keepExtensions: true,
              maxFileSize: 50 * 1024 * 1024, // 50MB
              filter: (part: Part) => {
                return part.mimetype?.startsWith('image/') || false
              }
            })

            const [fields, files] = await form.parse(req)
            const uploadedFile = Array.isArray(files.backgroundImage) ? files.backgroundImage[0] : files.backgroundImage
            const mapId = Array.isArray(fields.mapId) ? fields.mapId[0] : fields.mapId

            if (!uploadedFile) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No file uploaded' }))
              return
            }

            // Generate map-coded filename
            const originalName = uploadedFile.originalFilename || 'image'
            const fileExtension = path.extname(originalName)
            const mapCodedFilename = `map_${mapId || 'default'}_background${fileExtension}`
            const finalPath = path.join(uploadsDir, mapCodedFilename)

            // Move file to final location with proper name
            fs.renameSync(uploadedFile.filepath, finalPath)

            const response = {
              success: true,
              url: `/uploads/backgrounds/${mapCodedFilename}`,
              filename: mapCodedFilename,
              mapId: mapId || 'default',
              originalName: originalName,
              size: uploadedFile.size
            }

            console.log('✅ Background image uploaded successfully:', mapCodedFilename)
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
          const mapId = urlParts[urlParts.length - 1]

          try {
            const files = fs.readdirSync(uploadsDir)
            const backgroundFile = files.find(file => file.startsWith(`map_${mapId}_background`))

            if (backgroundFile) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                url: `/uploads/backgrounds/${backgroundFile}`,
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
          const mapId = urlParts[urlParts.length - 1]

          try {
            const files = fs.readdirSync(uploadsDir)
            const backgroundFile = files.find(file => file.startsWith(`map_${mapId}_background`))

            if (backgroundFile) {
              fs.unlinkSync(path.join(uploadsDir, backgroundFile))
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
