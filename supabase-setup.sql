-- Ejecutar esto en SQL Editor de Supabase

-- Tabla para guardar las imágenes
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para la configuración
CREATE TABLE config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  interval INTEGER DEFAULT 5000,
  transition INTEGER DEFAULT 1000
);

-- Configuración inicial
INSERT INTO config (id, interval, transition) VALUES (1, 5000, 1000);

-- Storage bucket (ejecutar en Storage > New Bucket)
-- Nombre: publicidad
-- Public: true
