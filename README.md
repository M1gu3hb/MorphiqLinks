# Morphiq Links

Landing de contacto para el QR de las tarjetas de Miguel Huerta Bautista. Interfaz pública en `/`, panel privado en `/admin`.

## Despliegue en Vercel

1. El proyecto Vercel `morphiq-links` ya está publicado. Vincula ese proyecto con el repositorio `M1gu3hb/MorphiqLinks` en **Settings → Git** para que los próximos cambios en `main` se desplieguen solos. Framework: **Other**. Los archivos públicos están en `public`.
2. Conecta una base **Upstash Redis** mediante Vercel Marketplace. Configura las variables de producción y preview:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `ADMIN_PASSWORD` (solo en variables de entorno, nunca en Git)
   - `SESSION_SECRET` (valor aleatorio de 32 bytes o más)
3. Vuelve a desplegar tras configurar las variables. URL estable: `https://morphiq-links.vercel.app`.

El backend reside en Vercel Functions (`api/`). Si Redis falla, los enlaces siguen funcionando, pero no cuentan el clic; el panel muestra un error en vez de datos inventados. Los eventos se agregan por día en la zona `America/Mexico_City`. Cada sesión anónima dura 12 horas. No se guarda IP en las estadísticas; Redis usa la IP temporalmente para limitar los intentos de contraseña. Los clics son aperturas de enlace, no llamadas o mensajes completados.

Las URL y etiquetas se editan en `api/_config.js`, y el texto visible en `public/index.html`. Al cambiar un enlace, modifica ambos y despliega de nuevo. No imprimas el QR hasta confirmar que la URL de producción funciona y permanece estable.
