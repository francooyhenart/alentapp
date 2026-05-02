| identifiacion | 1 |
| estado | Propuesto |
| autor | Esteban Trillo |
| fechas | 2026-05-01 |
| titulo | Gestion de Deportes | 

# TDD-01: Gestión de Deportes (Sport)

## 1. Contexto de Negocio

### 1.1. Objetivo

Gestionar los deportes que ofrece el Club Alentapp. Permite a los adminitradores crear, consultar, actualizar y gestionar las disciplinas deportivas disponibles, controlando sus cupos maximos y codiciones de acceso

### 1.2. User Personas

- **Administrativo**: yo como administrativo deportivo quiero crear nuevos deportes con su cupo maximo, precio adicional y descripcion
- **Cordinador Deportivo**: yo como cordinador deportivo quiero poder consultar los deportes disponibles para ofrecerle a los socios del club

### 1.3. Criterios de Aceptación

#### Historia de Usuario 1: Crear Deporte
- **Como** administrativo, **quiero** crear un nuevo deporte con nombre, descripcion y cupo maximo, **para** para ampliar la oferta deportiva del club.
- **Escenario de éxito**: si el administrativo completa de manera correcta los campos requeridos, el sistema debera responder creando el nuevo deporte y notificar la exitosa creacion.
- **Escenario de fallo**: si el administrativo ingresa una capacidad maxima de menor o igual a cero, el sistema debera responder con una advertencia de rango invalido invalido y no permitir el alta del nuevo deporte.

#### Historia de Usuario 2: Consultar Deportes
- **Como** cordinador deportivo, **quiero** listar todos los deportes disponibles, **para** conocer la oferta del club
- **Escenario de éxito**: si el cordinador deportivo busca un deporte a travez de nombre, el sistema debera mostrar solo los deportes que coincidan con campo cargado.
- **Escenario de fallo**: si el cordinador deportivo busca deportes a travez de un nombre vacio, el sistema debera notifcar que no existen deportes con ese campo vacio y no mostrar ninguna coincidencia.

#### Historia de Usuario 3: Editar Deporte
- **Como** administrativo, **quiero** quiero modificar la descripcion y/o el cupo maximo de un deporte, **para** mantener actualizada la lista de deportes que ofrece el club.
- **Escenario de éxito**: si el administrativo ingresa una nueva y/o un cupo maximo mayor a cero, el sistema debera actulizar el o los campos modificados y notificar como actualizacion exitosa. 
- **Escenario de fallo**: si el administrativo quiere cambiar el nombre de un deporte, el sistema debera e ignorar el cambio y notificar que no es posible realizar dicha actulizacion.

#### Historia de Usuario 3: Eliminar Deporte
- **Como** administrativo, **quiero** quiero eliminar un deporte, **para** mantener actualizada la lista de deportes que ofrece el club.
- **Escenario de éxito**: si el administrativo quiere eliminar un deporte, el sistema debera solicitar una confirmacion de eliminacion y en caso adirmativo, eliminar dicho deporte. 
- **Escenario de fallo**: si el socio intenta eliminar un deporte, el sistema debera notificar que no no tiene permisos para realizar dicha accion y redireccionarlo al inicio.

## 2. Diseño Técnico

### 2.1. Modelo de Dominio
Se definirá la entidad **Sport** con las siguientes propiedades y restricciones:

- **id**: identificador único universal (UUID) generado por el sistema
- **name**: cadena de texto. No puede ser modificado luego de su creación
- **description**: cadena de texto editable.
- **max_capacity**: número entero. Debe ser mayor a cero.
- **additional_price**: número. Representa el costo adicional del deporte.
- **requires_medical_certificate**: booleano. Indica si se requiere certificado médico para participar.

### 2.2. Contrato de API (Shared DTOs)
definiremos los tipos en el paquete compartido para asegurar la gestion:

#### Endpoint: Crear Deporte
**Método:** `POST /api/v1/sports`

**Request Body** (`CreateSportDto`):
```typescript
{
    name: string;                              //imutable luego de la cracion
    description: string;                       //editable
    max_capacity: int;                         // debe ser mayor a cero
    additional_price: number;
    requires_medical_certificate: boolean;
}
```
**Respose** (`201 Created`):
```typescript
{
    id: string;
    name: string;                              //imutable luego de la cracion
    description: string;                       //editable
    max_capacity: int;                         // debe ser mayor a cero
    additional_price: number;
    requires_medical_certificate: boolean;
}
```
#### Endpoint: Listar Desportes
**Método:** `GET /api/v1/sports`

**Respose** (`200 Ok`):
```typescript
{
    id: string;
    name: string;                              //imutable luego de la cracion
    description: string;                       //editable
    max_capacity: int;                         // debe ser mayor a cero
    additional_price: number;
    requires_medical_certificate: boolean;
}
```

#### Endpoint: Obtener Deporte
**Método:** `GET /api/v1/sports/:id`

**Respose** (`200 Ok`):
```typescript
{
    id: string;
    name: string;                              //imutable luego de la cracion
    description: string;                       //editable
    max_capacity: number;                 // debe ser mayor a cero
    additional_price: number;
    requires_medical_certificate: boolean;
}
```

#### Endpoint: Actualizar Deporte
**Método:** `PATCH /api/v1/sports/:id`

**Request Body** (`UpdateSportDto`):
```typescript
{
  description?: string;                       //editable
  max_capacity?: number;                  // debe ser mayor a cero
}
```

**Respose** (`200 Ok`):
```typescript
{
    id: string;
    name: string;                              //imutable luego de la cracion
    description: string;                       //editable
    max_capacity: number;                   // debe ser mayor a cero
    additional_price: number;
    requires_medical_certificate: boolean;
}
```

#### Endpoint: Eliminar Deporte
**Método:** `DELETE /api/v1/sports/:id`

### 2.3. Esquema de Persistencia (Prisma)

```prisma
model Sport{
    id          String    @id @default(uuid())
    name        String
    description String
    max_capacity number
    additional_price number @default(0)
    requires_medical_cerificate boolean @default(flase)

    enrollments   Enrollment []
}
```

## 3. Arquitectura y Flujo

### 3.1. Definición del Puerto

```typescript
export interface SportRepository{
  create(sport: Sport): Promise<Sport>
  findById(id: string): Promise<Sport | null>;
  findByName(name: string): Promise<Sport[]>;
  update(id: string, data: Partial<Omit<Sport, 'id' | 'name'>>): Promise<Sport>;
  daleteById(id: string): Promise<void>;
}
```

### 3.2. Lógica del Caso de Uso

**Caso de Uso:** `Crear Deporte` (CreateSporte)

**Flujo paso a paso:**

1.
   - validar que `name` no este vacio
   - validar que los datos sean del tipo esperado

2.
   - validar que `max_capacity` sea mayor a cero
   - validar que no exista ya un deporte con el mismo dato `name`

3.
   - mapear los datos del DTO recibido en una entidad del dominio Sport

4.
   - persistir el mapeo de dicos datos, a travez de SportRepository.crate(deporte)

5.
   - retornar SportResponseDto mapeado desde la entidad persistida y devolver con condigo 201 Created

**Caso de Uso:** `Actualizar Deporte` (UpdateSport)

**Flujo paso a paso:**

1.
   - validar la existencia del deporte a modificar
   - validar que solo se reciban los datos `max_capacity`y `description` o ignorar el resto de datos

2.
   - validar que `max_capacity` sea mayor a cero
   - validar que `max_capacity` no sea menor a la cantidad de inscriptos actuales (enrollments)

3.
   - mapear los datos del DTO recibido en la entidad asociada al deporte que se espera modificar

4.
   - persistir el mapeo de dicos datos, a travez de SportRepository.update()

5.
   - retornar SportResponseDto mapeado desde la entidad persistida actualizada

**Caso de Uso:** `Eliminar Deporte` (DeleteSport)

**Flujo paso a paso:**

1.
   - validar la existencia del deporte a eliminar a traves de su id

2.
   - validar que no existan inscripciones en el deporte a eliminar (enrollments)
   - solicitar confirmacion de eliminacion

3.
   - Ejecutar la eliminación del deporte a través del repositorio

4.
   - Confirmar la operación sin retornar contenido


## 4. Casos de Borde y Manejo de Errores

| Escenario de Error | Validación / Regla de Negocio | Código HTTP |
|-------------------|-------------------------------|-------------|
| **Datos Faltantes** | los campos obligatorios (name, max_capacity) deben estar presentes | `400` | 
| **Cupo Invalido** | el campo `max_capacity` debe ser mayor a cero. | `400` | 
| **Nombre Duplicado** | no pueden exixtir dos deportes con el mismo `name` | `409` |
| **Recurso Inexistente** | el `id` del deporte no existe en la base de datos. | `404` | 
| **Modificacion Invalida** | no se permite modificar el campo `name`una vez creado el deporte. | `400` |
| **Cupo menor a Inscriptos** | no se puede reducir el `max_capacity` por debajo de la cantidad de inscriptos actuales. | `409` |
| **Elimicacion de Inscriptos** | no se puede eliminar un deporte que tenga inscriptos asociados `enrollments`. | `409` | 
| **Error de Infraesctrutura** | falla la conexion con la base de datos. | `500` |

## 5. Observaciones Adicionales

### 5.1. Validaciones de datos
Se pueden utilizar librerías como `zod` para validar los datos de entrada en los DTOs, asegurando que los campos requeridos estén presentes y que `max_capacity` sea mayor a cero.

### 5.2. Consideraciones de negocio
- El campo `name` no debe poder modificarse una vez creado el deporte
- No se debe permitir reducir el `max_capacity` por debajo de la cantidad de inscriptos actuales.
- No se debe permitir eliminar un deporte si tiene inscripciones asociadas.

### 5.3. Consideraciones de seguridad
- Los endpoints de creación, modificación y eliminación deberían estar restringidos a usuarios con rol administrativo
- Los endpoints de consulta pueden ser accesibles a otros roles según necesidades del sistema

### 5.4. Posibles mejoras futuras
- Agregar control de cupos en tiempo real al momento de inscribir socios.
- Permitir filtros avanzados en la consulta de deportes (por nombre, disponibilidad de cupo, etc.)
