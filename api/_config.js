export const links = Object.freeze({
  whatsapp: { label: 'WhatsApp', url: 'https://wa.me/525523118153' },
  llamada: { label: 'Llamada', url: 'tel:+525523118153' },
  correo: { label: 'Correo', url: 'mailto:contacto@morphiq.com.mx' },
  sitio: { label: 'Sitio web', url: 'https://morphiq.com.mx' }
});
export const zone = 'America/Mexico_City';
export function localDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
