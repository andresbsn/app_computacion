# Patron ABM UI (Aplicar en todos los modulos)

Este documento define la estructura estandar para modulos ABM (alta, baja, modificacion) en la aplicacion.

## Estructura de pantalla

1. **Encabezado**
- Titulo del modulo
- Breve descripcion de objetivo operativo

2. **Barra de acciones y filtros**
- Filtro de texto libre (`search`)
- Filtros especificos del modulo (estado, tipo, activo, etc.)
- Boton principal `Nuevo`

3. **Listado principal**
- Tabla con datos clave de negocio
- Acciones por fila:
  - `Ver` (abre modal de detalle)
  - `Editar` (abre modal de edicion)

4. **Modal de alta/edicion**
- Misma vista para crear y editar
- Validaciones visuales y de backend
- Guardado con refresh de listado

5. **Modal de detalle**
- Datos completos de entidad
- Acciones de negocio asociadas
- Ejemplo clientes: cuenta corriente, historial, registrar pago

## Reglas de UX
- No navegar a otra ruta para acciones de ABM basicas.
- Usar modales para crear, editar y consultar detalle.
- Mantener filtros visibles en la pantalla principal.
- Priorizar lectura: columnas clave primero, datos secundarios en modal.

## Convenciones tecnicas
- Datos por `React Query`.
- Mutaciones con `useMutation` e invalidacion del `queryKey` del modulo.
- Cliente API centralizado en `src/lib/api.js`.
- Componente de modal reutilizable en `src/components/Modal.jsx`.
