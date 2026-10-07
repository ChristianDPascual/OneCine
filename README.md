# Trabajo Práctico de Programación IV

Trabajo Práctico de Programación IV de la **Tecnicatura Universitaria en Programación (UTN Avellaneda)**.

**Año:** 2026 — Segundo cuatrimestre.

[TP 1 - Programación IV - 2026 C2.pdf](https://github.com/user-attachments/files/33078239/TP.1.-.Programacion.IV.-.2026.C2.pdf)

## Link Firebase

https://one-cine.web.app/

## Objetivo

Desarrollar una aplicación web integral para la gestión y operación de un establecimiento de cine, centralizando en una única plataforma la administración de películas, salas, funciones, clientes, reservas, ventas y productos del Candy Bar.

La aplicación utiliza **Angular** como tecnología de front-end y **Supabase** como back-end, incluyendo la gestión de datos, autenticación y los servicios necesarios para el funcionamiento del sistema.

El objetivo es brindar una herramienta que permita tanto la gestión interna del establecimiento como una experiencia sencilla e intuitiva para los clientes, contemplando diferentes perfiles de usuario y permisos según sus responsabilidades.

## Requerimientos

[Requerimientos.xlsx](https://github.com/user-attachments/files/33078253/Requerimientos.xlsx)

# OneCine

## Concepto visual

Como referencia visual se tomó la página de Cinemark, adaptando su estética a una propuesta propia orientada a la gestión y experiencia de una sala de cine.

La idea rectora parte de la ambientación de una sala de cine: un espacio oscuro, donde predominan los negros y grises, mientras que el rojo toma protagonismo a partir de elementos característicos como los telones y las butacas.

Sobre esta base, se busca que los contenidos principales, especialmente los pósters y las películas, sean los elementos que más destaquen visualmente.

## Paleta de colores

- **Negros y grises (`cinema-black`, `cinema-surface`):** utilizados principalmente en fondos, tarjetas y superficies de la interfaz.
- **Rojo (`one-red`, `one-red-dark`):** color principal de identidad. Se utiliza en acciones relevantes, elementos seleccionados y estados como "En cartelera" o "Estreno".
- **Blanco y gris claro (`cinema-white`, `cinema-muted`):** utilizados para textos principales y secundarios.
- **Dorado (`cinema-gold`):** utilizado como color de acento para estrellas de reseñas y otros elementos destacados.

## Tipografías

- **Bebas Neue:** utilizada principalmente en los títulos de las películas, buscando una referencia a los afiches y marquesinas cinematográficas.
- **Montserrat:** utilizada en títulos de secciones y encabezados.
- **Poppins:** utilizada en el resto de la interfaz, especialmente en textos, precios, horarios y selección de butacas.

## Iconografía

### Logo

<table>
  <tr>
    <td bgcolor="#000000">
      <img width="2172" height="430" alt="logo-onecine" src="https://github.com/user-attachments/assets/730b5c37-8280-4db4-a82b-0389a0884eb0" />
    </td>
  </tr>
</table>

### Isotipo

<table>
  <tr>
    <td bgcolor="#000000">
      <img width="1278" height="1230" alt="LuLOGO" src="https://github.com/user-attachments/assets/83d9d404-e362-4ff4-9c3f-dcd81f854081" />
    </td>
  </tr>
</table>

### Spinner de carga

<table>
  <tr>
    <td bgcolor="#000000">
      <img width="400" height="277" alt="spinner_carga" src="https://github.com/user-attachments/assets/786b5ae2-a351-4385-8a84-3347310a06e9" />
    </td>
  </tr>
</table>

### Favicon

<table>
  <tr>
    <td bgcolor="#000000">
      <img width="512" height="512" alt="onecine-icon-512" src="https://github.com/user-attachments/assets/7014c5ae-615d-4031-881e-a83c215ac642" />
    </td>
  </tr>
</table>

### Plano del cine

<table>
  <tr>
    <td bgcolor="#000000">
      <img width="883" height="940" alt="plano-del-cine" src="https://github.com/user-attachments/assets/2e8edabd-f29f-4614-a9dc-aa8cdbccc902" />
    </td>
  </tr>
</table>

### Mockup de la página de inicio

<table>
  <tr>
    <td bgcolor="#000000">
      <img width="1600" height="800" alt="mockup-inicio" src="https://github.com/user-attachments/assets/3c3e3a74-689b-45a7-95de-91bf91a77c35" />
    </td>
  </tr>
</table>

# Arquitectura

OneCine es una **SPA desarrollada con Angular** que se conecta directamente con **Supabase**. No tiene un backend propio: las operaciones que necesitan mayor control, como compras, reservas, precios, puntos, crédito y validación de entradas, se resuelven mediante funciones de PostgreSQL llamadas desde Angular.

La idea principal es:

> **Angular se encarga de la interfaz y PostgreSQL de las reglas de negocio.**

El frontend puede validar datos y mostrar información al usuario, pero las operaciones importantes se vuelven a validar en la base de datos.

## Tecnologías

| Tecnología | Uso |
|---|---|
| **Angular 22** | Componentes standalone, Signals, formularios reactivos, routing y carga lazy. |
| **Supabase** | PostgreSQL, autenticación, Storage y Realtime. |
| **RxJS** | Formularios, consultas con debounce, router y service worker. |
| **PWA** | Instalación de la aplicación y caché de recursos. |
| **QRCode / jsQR** | Generación y lectura de códigos QR. |
| **jsPDF** | Comprobantes y reportes en PDF. |
| **SheetJS (xlsx)** | Exportación de reportes a Excel. |
| **Firebase Hosting** | Publicación de la aplicación. |

No se utiliza una librería de componentes UI. Los estilos son propios y se manejan principalmente mediante variables CSS.

## Estructura del proyecto

```text
src/app/
├── core/
│   ├── models/       Tipos, interfaces y lógica independiente de la vista
│   ├── services/     Acceso a Supabase y estado compartido
│   └── guards/       Control de acceso y navegación
├── components/       Componentes reutilizables
├── pages/             Pantallas de la aplicación
├── pipes/             Transformaciones utilizadas en las vistas
└── validators/        Validadores de formularios
```

La separación principal es:

- **Pages:** manejan el estado de cada pantalla y coordinan los servicios.
- **Components:** contienen elementos reutilizables de la interfaz.
- **Services:** concentran el acceso a Supabase y la lógica compartida.
- **Models:** definen los tipos utilizados por la aplicación.
- **Guards:** controlan el acceso y la navegación.

Los componentes no acceden directamente a Supabase, sino que utilizan los servicios correspondientes.

## Routing

Las rutas se encuentran en `app.routes.ts` y utilizan `loadComponent` para cargar las pantallas de forma lazy.

La aplicación está dividida principalmente en:

- **Sitio público:** inicio, cartelera, candy, registro y página 404.
- **Área del cliente:** compras, puntos, películas y crédito.
- **Compra:** entradas y candy, tanto para clientes como invitados.
- **Panel de administración:** dividido según el puesto del empleado.

Los filtros de cartelera se mantienen en la URL, permitiendo compartir directamente una búsqueda.

## Autenticación y permisos

Supabase Auth se utiliza para manejar los diferentes tipos de sesión.

### Cliente

Tiene una cuenta registrada y puede acceder a sus compras, puntos, crédito y películas.

### Invitado

Utiliza una sesión anónima y puede realizar compras sin registrarse. No tiene acceso a beneficios propios de clientes registrados.

### Empleado

Accede al panel administrativo y tiene un puesto que determina las secciones disponibles.

Los permisos se controlan en dos niveles:

1. **Angular:** mediante Guards.
2. **PostgreSQL:** mediante las funciones que ejecutan las operaciones.

De esta forma, ocultar una pantalla en Angular no es la única medida de seguridad.

## Gestión de datos

Las consultas simples se realizan desde los servicios utilizando Supabase.

Las operaciones que modifican información importante utilizan funciones de PostgreSQL mediante RPC.

Entre ellas:

- Reservar y liberar butacas.
- Confirmar compras.
- Realizar devoluciones.
- Validar entradas.
- Gestionar puntos y crédito.
- Programar funciones.
- Generar reportes.

Esto permite mantener las reglas de negocio en un único lugar.

### Storage

Supabase Storage se utiliza para almacenar imágenes de películas y productos.

### Realtime

El mapa de butacas utiliza Realtime para actualizarse cuando otra persona reserva o compra una butaca.

### PWA

La aplicación puede instalarse como PWA.

Se almacenan en caché recursos de la aplicación e imágenes, pero **no se cachean datos de negocio** como butacas, compras, puntos o crédito.

## Principales módulos

### Películas

Permite administrar películas, géneros, pósters, estrenos, preventas, clásicos y visibilidad.

La cartelera incluye búsqueda y filtros, y cada película cuenta con su propia ficha.

### Funciones

Permite crear, modificar y reprogramar funciones.

La asignación de salas y el control de superposición se resuelven en PostgreSQL, teniendo en cuenta también el tiempo necesario para la limpieza de la sala.

### Salas y butacas

Las butacas se generan automáticamente al crear una sala y pueden clasificarse como estándar, VIP o accesibles.

Una sala que ya tiene funciones no puede eliminarse.

### Compra de entradas

El proceso se divide en:

1. Selección de butacas.
2. Candy.
3. Pago.

Las butacas se reservan durante 10 minutos y la reserva se controla desde PostgreSQL para evitar conflictos entre usuarios.

Cada compra genera un QR y un comprobante en PDF.

### Candy Bar

Permite administrar productos y combos.

El carrito se comparte entre las diferentes pantallas de compra y también permite realizar compras únicamente de Candy.

### Precios y descuentos

Los precios y descuentos se administran desde el panel.

Las reglas se aplican en PostgreSQL para evitar que el frontend pueda modificar el resultado final.

### Puntos

Los puntos se manejan mediante movimientos.

Cada operación queda registrada y un trigger mantiene actualizado el saldo.

### Crédito y devoluciones

Las devoluciones pueden realizarse hasta 2 horas antes de la función.

El importe correspondiente se devuelve como crédito.

Cuando una compra utilizó puntos, se genera crédito por el valor correspondiente al momento del canje.

### QR

Cada compra genera un único QR:

```text
ONECINE|COMPRA|<código>
```

Puede leerse con la cámara o ingresarse manualmente.

Antes de confirmar un canje, el empleado puede revisar los elementos que se van a entregar.

La base de datos controla que cada elemento pueda validarse una sola vez y registra quién realizó el canje.

### Reseñas

Los clientes pueden calificar películas de 1 a 5 estrellas y agregar un comentario.

Solo se permite una reseña por película.

### Área del cliente

Incluye:

- Mis compras.
- Mis películas.
- Mis puntos.
- Mi crédito.

Desde estas secciones el cliente puede consultar su información y gestionar sus compras.

### Panel de empleados

El acceso se divide según el puesto:

- Administrador.
- Supervisor.
- Boletería.
- Confitería.

Cada puesto tiene acceso únicamente a las secciones correspondientes.

### Reportes

Los administradores pueden consultar reportes de:

- Facturación.
- Entradas vendidas.
- Rangos de fechas.

Los resultados pueden visualizarse en pantalla y exportarse a PDF o Excel.

### Log de actividad

Las acciones importantes del sistema se registran mediante triggers de PostgreSQL.

El historial puede consultarse desde el panel con filtros y paginación.

# Decisiones técnicas

## Reglas de negocio en PostgreSQL

Los precios, descuentos, puntos, crédito, devoluciones y permisos se validan en la base de datos.

Angular puede anticipar errores y mejorar la experiencia, pero la validación final no depende del frontend.

## Operaciones atómicas

Las operaciones críticas utilizan transacciones y bloqueos de filas.

Esto permite evitar problemas como vender una misma butaca dos veces o utilizar los mismos puntos en operaciones simultáneas.

## Signals y RxJS

El estado de las pantallas se maneja principalmente con **Signals**.

RxJS se utiliza cuando aporta una ventaja concreta, por ejemplo en formularios, búsquedas con `debounceTime` y `switchMap`, router y service worker.

## Componentes reutilizables

Se priorizó reutilizar componentes cuando una misma funcionalidad aparece en diferentes partes de la aplicación.

Por ejemplo, el validador QR se utiliza tanto en boletería como en confitería y los componentes de pago se comparten entre diferentes tipos de compra.

## Guards desacoplados

Los Guards de salida no conocen la implementación de cada pantalla.

Las pantallas implementan interfaces que indican si tienen cambios sin guardar, una compra en curso o un comprobante pendiente.

## Permisos centralizados

Los puestos y las secciones permitidas se definen en `SECCIONES_ADMIN`.

Esta configuración se utiliza tanto para controlar las rutas como para mostrar las opciones disponibles en el panel.

## PWA sin datos de negocio en caché

No se almacenan en caché datos como butacas, compras, puntos o crédito.

En un sistema de cine, trabajar con información desactualizada podría generar errores en una reserva o una compra.

## Reportes en el navegador

Los archivos PDF y Excel se generan directamente desde Angular, sin necesidad de un servidor adicional para esta tarea.

**Programación IV — 2026**
