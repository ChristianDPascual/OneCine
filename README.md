# Trabajo Practico de Programación 4 en la Tecnicatura Universitaria en Programación (UTN Avellaneda). 

[TP 1 - Programacion IV - 2026 C2.pdf](https://github.com/user-attachments/files/33078239/TP.1.-.Programacion.IV.-.2026.C2.pdf)

Año: 2026, Segundo cuatrimestre.

# Objetivo

Desarrollar una aplicación web integral para la gestión y operación de un establecimiento de cine, centralizando en una única plataforma la administración de películas, salas, funciones, clientes, reservas, ventas y productos del Candy Bar.

La aplicación contará con Angular como tecnología de front-end y Supabase como back-end, incluyendo la gestión de datos, autenticación y servicios necesarios para el funcionamiento del sistema.

El objetivo es brindar una herramienta que permita tanto la gestión interna del establecimiento como una experiencia sencilla e intuitiva para los clientes, contemplando diferentes perfiles de usuario y permisos según sus responsabilidades.

# Requerimientos:

[Requerimientos.xlsx](https://github.com/user-attachments/files/33078253/Requerimientos.xlsx)


# OneCine

Concepto visual:
Como referencia visual se tomó la página de Cinemark, adaptando su estética a una propuesta propia orientada a la gestión y experiencia de una sala de cine.

La idea rectora parte de la ambientación de una sala de cine: un espacio oscuro, donde predominan los negros y grises, mientras que el rojo toma protagonismo a partir de elementos característicos como los telones y las butacas. Sobre esta base, se busca que los contenidos principales, especialmente los pósters y las películas, sean los elementos que más destaquen visualmente.

## Paleta de colores

Negros y grises (cinema-black, cinema-surface): utilizados principalmente en fondos, tarjetas y superficies de la interfaz. La intención es recrear la sensación de una sala de cine a oscuras y generar un entorno visual que permita destacar el contenido.

Rojo (one-red, one-red-dark): funciona como color principal de identidad y se reserva para acciones relevantes, elementos seleccionados y estados como “En cartelera” o “Estreno”. El tono oscuro se utiliza para estados hover, fondos y degradados.

Blanco y gris claro (cinema-white, cinema-muted): destinados al texto principal y secundario, buscando mantener una correcta legibilidad y contraste sobre los fondos oscuros.

Dorado (cinema-gold): utilizado como color de acento para estrellas de reseñas y elementos destacados, inspirado en la iluminación y estética de las marquesinas tradicionales de cine.

## Tipografías

Bebas Neue: utilizada principalmente en los títulos de las películas. Su estilo condensado y en mayúsculas remite a los afiches cinematográficos y las marquesinas.

Montserrat: destinada a títulos de secciones, encabezados y elementos que requieren mayor presencia visual.

Poppins: utilizada para el resto de la interfaz, especialmente en textos, precios, horarios y selección de butacas, priorizando la legibilidad en tamaños pequeños.

## Iconografia:
Logo:

<table>
  <tr>
    <td bgcolor="#000000">

<img width="2172" height="430" alt="logo-onecine" src="https://github.com/user-attachments/assets/730b5c37-8280-4db4-a82b-0389a0884eb0" />


  </td>
  </tr>
</table>

Isotipo:

<table>
  <tr>
    <td bgcolor="#000000">

<img width="1278" height="1230" alt="LuLOGO" src="https://github.com/user-attachments/assets/83d9d404-e362-4ff4-9c3f-dcd81f854081" />

  </td>
  </tr>
</table>


Spinner de carga:

<table>
  <tr>
    <td bgcolor="#000000">

<img width="400" height="277" alt="spinner_carga" src="https://github.com/user-attachments/assets/786b5ae2-a351-4385-8a84-3347310a06e9" />


  </td>
  </tr>
</table>


Favicon:

<table>
  <tr>
    <td bgcolor="#000000">

<img width="512" height="512" alt="onecine-icon-512" src="https://github.com/user-attachments/assets/7014c5ae-615d-4031-881e-a83c215ac642" />


  </td>
  </tr>
</table>

Plano del cine:

<table>
  <tr>
    <td bgcolor="#000000">

<img width="883" height="940" alt="image" src="https://github.com/user-attachments/assets/2e8edabd-f29f-4614-a9dc-aa8cdbccc902" />

  </td>
  </tr>
</table>


Mockup de la página de inicio


<table>
  <tr>
    <td bgcolor="#000000">

<img width="1600" height="800" alt="image" src="https://github.com/user-attachments/assets/3c3e3a74-689b-45a7-95de-91bf91a77c35" />

  </td>
  </tr>
</table>

Arquitectura

La aplicación está organizada siguiendo una estructura modular, separando la lógica de negocio, los componentes reutilizables, las páginas y las validaciones.

```text
src/
├── core/
│   ├── models/
│   ├── services/
│   └── guards/
│
├── components/
│   ├── campo-fecha/
│   ├── estrellas/
│   ├── tarjeta-pelicula/
│   ├── codigo-qr/
│   └── detalle-pelicula/
│
├── pages/
│   ├── cliente/
│   │   ├── home/
│   │   ├── cartelera/
│   │   ├── candy/
│   │   ├── comprar/
│   │   └── mis-entradas/
│   │
│   └── admin/
│
├── pipes/
│   ├── clasificacion/
│   └── duracion/
│
└── validators/
```

core/

Contiene los elementos centrales de la aplicación:

models/: modelos y estructuras de datos utilizados por el sistema.

services/: servicios encargados de la comunicación con Supabase y de las operaciones de negocio. Se contempla un servicio por tabla o por caso de uso, según corresponda.

guards/: control de acceso y protección de rutas según el tipo de usuario o sus permisos.

components/

Contiene componentes reutilizables de la interfaz:

campo-fecha/: selección y visualización de fechas.

estrellas/: representación de calificaciones.

tarjeta-pelicula/: presentación resumida de una película.

codigo-qr/: generación y visualización de códigos QR.

detalle-pelicula/: información detallada de una película.

pages/

Contiene las diferentes vistas y funcionalidades principales de la aplicación.

Cliente

home/: página principal.

cartelera/: películas y funciones disponibles.

candy/: productos y opciones del Candy Bar.

comprar/: proceso de selección y compra.

mis-entradas/: consulta de entradas adquiridas.

Administración

admin/: funcionalidades destinadas a la gestión interna del establecimiento.

pipes/

Contiene transformaciones reutilizables para la presentación de información:

clasificacion/: adaptación y visualización de las clasificaciones de las películas.

duracion/: conversión y presentación de la duración de las películas en un formato legible.

validators/

Contiene las reglas de validación utilizadas en formularios y procesos de carga de información, permitiendo centralizar y reutilizar las validaciones del sistema.

