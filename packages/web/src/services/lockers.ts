const API_URL = 'http://192.168.0.71:3000/api/v1/lockers';

// Función auxiliar para parsear errores del backend (si ya la tenés importada, podés borrar esta)
const parseError = async (response: Response, defaultMessage: string): Promise<string> => {
  try {
    const errorData = await response.json();
    return errorData.message || defaultMessage;
  } catch {
    return defaultMessage;
  }
};

export const lockerService = {
  // Obtener todos los casilleros
  getAll: async () => {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(await parseError(response, 'Error al obtener los casilleros'));
    return response.json();
  },

  // Crear un nuevo casillero
  createLocker: async (number: number, location: string) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, location }),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Error al crear el casillero'));
    return response.json();
  },

  // Reservar un casillero (PATCH)
  reserveLocker: async (id: string, memberId: string) => {
    const response = await fetch(`${API_URL}/${id}/reserve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ member_id: memberId }),
    });

    if (!response.ok) {
      throw new Error('Error al reservar el casillero');
    }
    return response.json();
  },

  // Liberar un casillero (PATCH con cabecera)
  releaseLocker: async (id: string, memberId: string) => {
    const response = await fetch(`${API_URL}/${id}/release`, {
      method: 'PATCH',
      headers: {
        'x-user-id': memberId,
      },
    });

    if (!response.ok) {
      throw new Error('Error al liberar el casillero');
    }
    return response.json();
  },

  // Eliminar un casillero
  deleteLocker: async (id: string) => {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(await parseError(response, 'Error al eliminar el casillero'));
    // Generalmente los DELETE devuelven 204 No Content, si el tuyo devuelve JSON, descomentá la línea de abajo:
    // return response.json();
  },

  // Cambiar el estado a Mantenimiento o Disponible
  updateStatus: async (id: string, status: 'Available' | 'Maintenance') => {
    const response = await fetch(`${API_URL}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Error al actualizar el estado del casillero'));
    return response.json();
  }
};