# Stookwijzer

El **Stookwijzer** del RIVM (el instituto nacional neerlandés de salud pública
y medio ambiente) indica, para cada código postal de 4 cifras de los Países
Bajos, si encender ahora una estufa de leña, una chimenea, un calefactor de
terraza o un brasero molesta al vecindario. Esta integración lleva ese consejo
a Gladys para cada una de sus casas: un dispositivo con el consejo actual y el
de las próximas franjas, el viento y el índice de calidad del aire, un widget
del panel y disparadores de escena.

> El Stookwijzer solo cubre los **Países Bajos**. En otros lugares, la
> integración no tiene nada que mostrar y lo indica. No está afiliada al RIVM.

## Lo que obtiene

- Un dispositivo **Stookwijzer** por cada casa de Gladys situada en los
  Países Bajos.
- El **consejo** en tres códigos, tal como los da el RIVM:
  - **Amarillo**: «Atención: quemar leña molesta y contamina el aire» (viento
    de fuerza 3 o más y LKI de 3 o menos);
  - **Naranja**: «Mejor no quemar leña ahora» (viento de fuerza 3 o más y LKI
    de 4, 5 o 6);
  - **Rojo**: «No queme leña» (viento de fuerza 2 o menos, o LKI de 7 o más).
- El consejo de las **tres próximas franjas de 6 horas** (04:00-10:00,
  10:00-16:00, 16:00-22:00 y 22:00-04:00, hora neerlandesa).
- La **velocidad del viento** (m/s), la **fuerza del viento** (Beaufort) y el
  **índice de calidad del aire** (LKI, de 1 a 11) en los que se basa el
  consejo.
- Un **widget** del panel y tres **disparadores de escena**.

No existe el código verde: no quemar leña es siempre el mejor consejo para un
entorno sano, por eso el RIVM lo dejó fuera a propósito.

## Requisitos

- Gladys Assistant 5.1 o posterior.
- Una casa con una **ubicación** en Gladys (Configuración, Viviendas, el mapa
  de la casa), en los Países Bajos. La integración solicita acceso a la
  ubicación de sus casas al instalarla: solo sirve para encontrar el código
  postal, y solo el punto convertido se envía al RIVM.
- Acceso a Internet desde Gladys hacia `data.rivm.nl`. Sin cuenta ni clave.

## Configuración

1. Instale la integración y acepte el acceso a la ubicación de sus casas.
2. En **Configuración**, elija el **idioma** de los nombres de las funciones,
   del texto del consejo y de las variables de escena (francés por defecto).
   Los nombres se fijan al crear el dispositivo: elija primero el idioma.
3. Abra la pestaña **Descubrir**: aparece un dispositivo «Stookwijzer _casa_»
   para cada casa situada en los Países Bajos. Añádalo a Gladys.

Una ubicación añadida o modificada después en Gladys se vuelve a leer en la
siguiente lectura horaria, o enseguida con el botón **Buscar** de la pestaña
Descubrir.

## Dispositivos

Cada dispositivo «Stookwijzer _casa_» tiene ocho funciones, todas de solo
lectura:

| Función                          | Tipo             | Valores                       |
| -------------------------------- | ---------------- | ----------------------------- |
| Consejo actual                   | Nivel de riesgo  | 1 amarillo, 2 naranja, 3 rojo |
| Consejo                          | Texto            | «Naranja: Mejor no...»        |
| Consejo próxima franja           | Nivel de riesgo  | 1 amarillo, 2 naranja, 3 rojo |
| Consejo en 2 franjas             | Nivel de riesgo  | 1 amarillo, 2 naranja, 3 rojo |
| Consejo en 3 franjas             | Nivel de riesgo  | 1 amarillo, 2 naranja, 3 rojo |
| Velocidad del viento             | Velocidad (m/s)  | 0 a 60                        |
| Fuerza del viento (Beaufort)     | Velocidad        | 0 a 12                        |
| Índice de calidad del aire (LKI) | Calidad del aire | 1 a 11                        |

Gladys muestra los niveles de riesgo «Bajo», «Medio» y «Alto»: corresponden
a amarillo, naranja y rojo. «Sin riesgo» (0) nunca se usa. El consejo de la
franja actual y el de la siguiente son **definitivos**; los dos siguientes son
provisionales y pueden cambiar hasta 6 horas antes de su inicio.

Los valores se leen **una vez por hora**. Solo se envían a Gladys los valores
que cambian, y todos cada 12 horas, para que el panel nunca muestre «ningún
valor reciente».

## Widget del panel

Añada el widget **Stookwijzer** a un panel. Muestra el consejo de la franja
actual en palabras, la fuerza del viento y el LKI en mosaicos en directo, la
lista de la franja actual y de las tres siguientes con su color (las
provisionales están marcadas), el código postal y un botón hacia la página
oficial del Stookwijzer. En sus ajustes, elija la casa; si lo deja vacío, se
muestra el primer dispositivo Stookwijzer.

## Disparadores de escena

En el editor de escenas, bajo la integración:

- **Stookwijzer: código rojo (no quemar leña)**: el consejo actual de la casa
  pasa a rojo.
- **Stookwijzer: fin del código rojo**: el consejo actual vuelve a ser
  amarillo o naranja. El filtro «Nuevo consejo» permite quedarse con uno solo.
- **Stookwijzer: código rojo anunciado en la próxima franja**: la próxima
  franja será roja con seguridad (consejo definitivo), aunque ahora no lo sea.
  Una vez por franja, unas 6 horas antes.

Cada disparador puede limitarse a una casa. Las acciones siguientes pueden
usar `{{triggerEvent.data.advice_text}}`, `starts_at` y `ends_at` (las horas
de la franja, en la zona horaria de Gladys), `postcode`, `wind_force` y
`lki`.

Un disparador nunca se activa en la primera lectura de una casa, ni de nuevo
tras un reinicio de la integración para el mismo consejo. El dispositivo debe
estar añadido a Gladys para que sus disparadores se activen.

## Ejemplos de escenas

- **Avisar antes de encender la estufa**: disparador «código rojo anunciado
  en la próxima franja», acción «Enviar un mensaje»: «Código rojo a partir de
  las {{triggerEvent.data.starts_at}}: no queme leña.»
- **Recordatorio por la tarde**: a las 18:00, si «Consejo actual» de la casa
  vale 3 (Alto), enviar «Stookwijzer: no encienda la estufa esta noche.»
- **Vuelta a la normalidad**: disparador «fin del código rojo», filtro
  «Amarillo», apagar la tira LED roja que señalaba la alerta.

## Fuentes de datos y cuotas

El consejo procede del servicio geográfico abierto del RIVM
(`data.rivm.nl/geo/alo`, capa `stookwijzer_v2`), los mismos datos que la
página Stookwijzer del Atlas Leefomgeving. La integración consulta una vez por
hora y por casa, lo que basta: el consejo cambia por franja de 6 horas. El
viento y el LKI son cálculos de modelo (KNMI, RIVM) promediados por franja:
pueden diferir de las mediciones y del viento en su casa.

## Solución de problemas

- **Ningún dispositivo en Descubrir**: dé a su casa una ubicación en Gladys,
  en los Países Bajos, y pulse **Buscar**. El estado de la pantalla de
  configuración indica el motivo: ninguna casa con ubicación, o casas fuera de
  los Países Bajos.
- **«El servicio geográfico del RIVM no responde»**: el último consejo sigue
  visible; la integración lo vuelve a intentar cada 10 minutos.
- **Los nombres de las funciones están en otro idioma**: se fijan al crear el
  dispositivo. Cambie el idioma, elimine el dispositivo y añádalo de nuevo (se
  pierde su historial).
- Para más detalle, configure `LOG_LEVEL=debug` y lea los registros de la
  integración.

## Límites

- Solo Países Bajos; el consejo es el del código postal de 4 cifras de la
  casa.
- Desarrollada y probada con los datos reales del RIVM, pero sin consejo
  naranja ni rojo el día del desarrollo: esos casos se prueban con
  grabaciones modificadas. Sus comentarios son bienvenidos.
- El Stookwijzer es un consejo. Algunos municipios prohíben quemar leña con
  código naranja o rojo: consulte las normas locales.
- Sin afiliación con el RIVM.
