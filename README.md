# Panel de Publicidad

Carrusel de imágenes para TV en local o publicado en internet.

## Uso

### 1. Configuración

Crea un archivo `.env` con las credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-llave-publica
VITE_ADMIN_PASSWORD=tu-contraseña
```

### 2. Ejecutar localmente

```bash
cd publicidad-ft
npm install
npm run dev
```

- **Carrusel:** http://localhost:5173/
- **Admin:** http://localhost:5173/admin

### 3. Publicar en Vercel

1. Sube el proyecto a GitHub
2. Ve a [vercel.com](https://vercel.com)
3. Importa el proyecto desde GitHub
4. Añade las variables de entorno en Vercel Dashboard
5. Deploy

### 4. Contraseña

La contraseña por defecto es: `publicidad2024`

Para cambiarla, modifica `VITE_ADMIN_PASSWORD` en el `.env`

## Rutas

- `/` - Vista del carrusel (público)
- `/admin` - Panel de administración (requiere contraseña)
# Publicidad-FT
# Publicidad-FT
