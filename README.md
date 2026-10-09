# Tibox Eventos
Aplicación compartida para organización y recepción de eventos. Incluye múltiples eventos, asistentes, importación CSV de Excel, estados de asistencia, credenciales, vista de anfitriona con avisos amarillos, tablero de llegadas, itinerario y control de regalos.

## Ejecutar
Requiere Python 3.10 o superior, sin dependencias externas.

```bash
python server.py
```
Abre http://localhost:8080. Para la anfitriona usa la misma dirección del servidor con `?view=host`. En otra computadora o teléfono de la misma red, usa la IP del servidor en lugar de localhost. Ambas vistas consultan la misma base de datos y se actualizan cada 3 segundos cuando no hay una edición activa.

Configura `PORT` y `EVENTOS_DB` mediante variables de entorno si necesitas cambiar puerto o ubicación de la base. La base por defecto está en `data/eventos.db`; respalda esa carpeta. Para publicar utiliza un servidor con disco persistente y Python, o el Dockerfile incluido con un volumen en `/app/data`.

## Importar asistentes
Descarga la plantilla desde Asistentes. Columnas: `nombre;empresa;cargo;correo;credencial;estado`. Guarda desde Excel como CSV UTF-8. Solo el nombre es obligatorio. Estados aceptados: Pendiente, Confirmado, Viene llegando, Llegó y No vendrá. La importación agrega registros; no reemplaza ni deduplica asistentes.

## Acceso
Esta versión está pensada para un equipo de recepción de confianza en una red privada. No incluye autenticación ni roles de seguridad: la vista de anfitriona es una vista operativa. Antes de exponer el servicio a Internet, configura un proxy con HTTPS y control de acceso (por ejemplo VPN o autenticación del proxy). No guardes datos personales de asistentes en GitHub.

El control de regalos registra cada entrega por asistente. El servidor valida el stock dentro de una transacción para evitar entregar más unidades de las disponibles.
