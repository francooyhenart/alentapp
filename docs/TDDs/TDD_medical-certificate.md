---
Estado: Propuesto 
autor: Lautaro Flores
fecha: 2026-05-02
titulo: Gestión de Certificados Médicos 
---

# TDD-[02]: Gestión de Certificados Médicos

## 1. Contexto de Negocio

### 1.1. Objetivo
Gestionar el ciclo de vida de los certificados médicos de los socios del Club Alentapp. Este módulo actúa como una barrera de seguridad legal y sanitaria, garantizando que un socio solo pueda inscribirse y participar en actividades deportivas si cuenta con un apto físico vigente, validado por la administración y dentro de las fechas permitidas.

### 1.2. User Persona
*   **Administrativo**: Necesita registrar el certificado médico físico que presenta el socio, validar su autenticidad y asegurarse de que el sistema bloquee automáticamente a los socios cuyo certificado haya vencido.
*   **Socio**: Necesita conocer el estado de su apto médico (vigente o vencido) para saber si está habilitado para realizar las prácticas deportivas a las que está inscripto.

### 1.3. Criterios de Aceptación (User Stories)

#### Historia de Usuario 1: Registro de nuevo certificado
*   **Como** Administrativo, **quiero** registrar un nuevo certificado médico para un socio **para** que pueda estar habilitado a realizar deportes.
*   **Escenario de éxito**: Si el administrativo completa todos los campos (fecha emisión, vencimiento, matrícula y miembro) y las fechas son coherentes, el sistema guarda el nuevo registro como "No Validado" y automáticamente marca cualquier certificado anterior de ese socio como histórico/inválido.
*   **Escenario de fallo**: Si el administrativo ingresa una fecha de vencimiento anterior a la de emisión, el sistema debe mostrar un mensaje de error impidiendo la carga.

#### Historia de Usuario 2: Validación Administrativa
*   **Como** Administrativo, **quiero** validar un certificado ya cargado **para** confirmar que la documentación física es correcta y habilitar oficialmente al socio.
*   **Escenario de éxito**: Al marcar el certificado como "Validado", el socio queda habilitado para inscribirse en actividades deportivas.
*   **Escenario de fallo**: Si se intenta validar un certificado cuya fecha de vencimiento ya pasó, el sistema debe informar que el documento está expirado y no permitir la validación.

#### Historia de Usuario 3: Consulta de Estado
*   **Como** Socio, **quiero** consultar si mi certificado está vigente **para** saber si puedo asistir a mis clases.
*   **Escenario de éxito**: El sistema devuelve el estado actual (Validado/Pendiente) y los días restantes hasta el vencimiento.
*   **Escenario de fallo**: Si el socio no tiene ningún certificado cargado, el sistema debe mostrar un aviso indicando que debe presentar la documentación a la brevedad.


## 2. Diseño Técnico 

### 2.1. Modelo de Dominio (Entidad)
Definiremos la entidad **MedicalCertificate**. Siguiendo el DER, la estructura es la siguiente:

*   **Entidad**: `MedicalCertificate`
*   **Campos**:
    *   `id`: `String` (UUID, Primary Key).
    *   `issue_date`: `DateTime` (Fecha de emisión del certificado).
    *   `expiry_date`: `DateTime` (Fecha de vencimiento).
    *   `doctor_license`: `String` (Matrícula del profesional).
    *   `is_validated`: `Boolean` (Default: `false`).
    *   `member_id`: `String` (UUID, Foreign Key hacia Member).

### 2.2. Contrato de API (Shared DTOs)
Definimos los objetos que viajan por la red. Estos deben estar en el paquete `@alentapp/shared` para que sean accesibles tanto por el frontend como por el backend

*   **Endpoint**: `POST /api/v1/medical-certificates`
*   **Request Body**:
```ts
export interface CreateMedicalCertificateRequest {
    member_id: string;      // ID del socio al que pertenece el certificado
    issue_date: string;     // Fecha de emisión en formato ISO
    expiry_date: string;    // Fecha de vencimiento en 
    doctor_license: string; // Matrícula del médico interviniente
}
```

*   **Response Body**:
```ts
export interface MedicalCertificateDTO {
    id: string;
    member_id: string;
    issue_date: string;
    expiry_date: string;
    doctor_license: string;
    is_validated: boolean; // Estado de validación por el administrativo
}
```

## 3. Arquitectura y Flujo (Componentes de Arquitectura Hexagonal)

### 3.1. Definición del Puerto (Repository Interface)
El Puerto pertenece a la capa de **Dominio** y define el contrato que la infraestructura debe cumplir para interactuar con la base de datos.

*   **Métodos necesarios**:
    *   `save(certificate: MedicalCertificate): Promise<void>`: Para persistir el nuevo certificado.
    *   `findByMemberId(memberId: string): Promise<MedicalCertificate[]>`: Para recuperar el historial del socio y aplicar la regla de "invalidar anteriores".
    *   `update(certificate: MedicalCertificate): Promise<void>`: Para actualizar estados de validación o vigencia.

### 3.2. Lógica del Caso de Uso 
El caso de uso `CreateMedicalCertificate` ejecutará los siguientes pasos:

1.  **Validación de Datos**: Se comprueba que los campos obligatorios del DTO estén presentes y tengan el formato correcto.
2.  **Validación de Regla de Negocio (Fechas)**: Se verifica que la `expiry_date` sea estrictamente posterior a la `issue_date`.
3.  **Verificación de Existencia**: Se consulta al `MemberRepository` para asegurar que el socio exista.
4.  **Aplicación de Unicidad Activa**: Se busca el historial de certificados del socio. Si existe uno activo, se procede a su invalidación para que el nuevo pase a ser el único vigente del socio.
5.  **Mapeo y Persistencia**: Se transforma el DTO en una entidad de Dominio y se envía al `MedicalCertificateRepository` para su almacenamiento.

### 3.3. Distribución en Capas
Siguiendo la estructura del proyecto Alentapp, los componentes se ubican de la siguiente manera:

*   **Domain**: Contiene la entidad `MedicalCertificate`, las reglas de validación puras y la interfaz del Repositorio (Puertos).
*   **Application**: Contiene los Casos de Uso que coordinan las acciones de negocio.
*   **Infrastructure**: Contiene el controlador (`MedicalCertificateController`) que recibe el HTTP, y la implementación concreta de Prisma (`PostgresMedicalCertificateRepository`).


## 4. Casos de Borde y Errores

| Escenario de Error | Validación / Regla de Negocio | Resultado Esperado | Código HTTP |
| :--- | :--- | :--- | :--- |
| **Fechas inconsistentes** | La `expiry_date` debe ser posterior a la `issue_date`. | Mensaje: "La fecha de vencimiento no puede ser anterior a la de emisión". | 400 Bad Request |
| **Socio inexistente** | El `member_id` proporcionado debe existir en la base de datos. | Mensaje: "El socio especificado no existe". | 404 Not Found |
| **Campos faltantes** | Todos los campos (`member_id`, `issue_date`, `doctor_license`) son obligatorios. | Mensaje: "Faltan campos requeridos en la solicitud". | 400 Bad Request |
| **Certificado ya vencido** | No se puede cargar un certificado cuya fecha de vencimiento ya pasó. | Mensaje: "No se permiten cargar certificados con fecha de vencimiento expirada". | 422 Unprocessable Entity |
| **Validación prohibida** | No se puede validar (`is_validated = true`) un certificado que no cumple con el formato de matrícula. | Mensaje: "La matrícula médica no tiene un formato válido para su aprobación". | 400 Bad Request |
| **Error de servidor** | Falla de conexión con el contenedor de Postgres en Docker. | Mensaje: "Error interno del servidor. Intente nuevamente más tarde". | 500 Internal Server Error |

## 5. Observaciones Adicionales

*   **Manejo de Fechas**: uso de las funciones nativas de JavaScript para asegurar que las comparaciones de fechas contemplen correctamente los husos horarios.
*   **Seguridad**: El acceso a los endpoints de creación y validación de certificados debe estar restringido a usuarios con rol de "Administrativo" mediante un middleware de autenticación.
*   **Escalabilidad**: Se prevé que, a futuro, el sistema envíe una notificación automática al socio cuando su certificado esté próximo a vencer (ej: 15 días antes).

