import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-publicidad-ft'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
const storage = multer.memoryStorage()
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

app.use(cors())
app.use(express.json())

const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' })
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.admin = decoded
    next()
  } catch (e) {
    res.status(401).json({ error: 'Token inválido' })
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/login', (req, res) => {
  const { password } = req.body
  if (password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token })
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' })
  }
})

app.get('/api/images', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/config', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('config')
      .select('*')
      .eq('id', 1)
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.json({ interval: 5000, transition: 1000 })
  }
})

app.post('/api/images', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' })
    }

    const fileExt = req.file.originalname.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('FT')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('FT')
      .getPublicUrl(fileName)

    const { error: dbError } = await supabase
      .from('images')
      .insert([{ url: urlData.publicUrl, name: req.file.originalname }])

    if (dbError) throw dbError

    const { data } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: true })

    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/images/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { url } = req.body
    const fileName = url.split('/').pop()

    await supabase.storage
      .from('FT')
      .remove([fileName])

    await supabase
      .from('images')
      .delete()
      .eq('id', id)

    const { data } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: true })

    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/images', authenticate, async (req, res) => {
  try {
    const { data: images } = await supabase
      .from('images')
      .select('*')

    if (images && images.length > 0) {
      const fileNames = images.map(img => img.url.split('/').pop())
      await supabase.storage
        .from('FT')
        .remove(fileNames)

      await supabase
        .from('images')
        .delete()
        .gt('id', 0)
    }

    res.json([])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/images/:id/priority', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { priority } = req.body
    console.log(`Actualizando prioridad de imagen ${id} a ${priority}`)

    const { data, error } = await supabase
      .from('images')
      .update({ priority })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    console.log('Prioridad actualizada:', data)
    res.json(data)
  } catch (e) {
    console.error('Error al actualizar prioridad:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/config', authenticate, async (req, res) => {
  try {
    const { interval, transition } = req.body
    await supabase
      .from('config')
      .upsert([{ id: 1, interval, transition }])
    res.json({ interval, transition })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend corriendo en http://0.0.0.0:${PORT}`)
})
