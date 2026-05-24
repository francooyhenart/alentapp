const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1/lockers';

async function parseError(response: Response, fallback: string) {
  try {
    const errorData = await response.json();
    return errorData.error || fallback;
  } catch {
    return fallback;
  }
}

export const lockerService = {
  // Obtener todos los casilleros
  getAll: async () => {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(await parseError(response, 'Error al obtener los casilleros'));
    return response.json();
  },

  // Crear un nuevo casillero
  // Método para crear (POST)
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
  // Para reservar (PATCH)
  reserveLocker: async (id: string, memberId: string) => {
    const response = await fetch(`${API_URL}/${id}/reserve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Error al reservar el casillero'));
    return response.json();
  },

  // Liberar un casillero (PATCH con cabecera)
  // Para liberar (PATCH)
  releaseLocker: async (id: string, memberId: string) => {
    const response = await fetch(`${API_URL}/${id}/release`, {
      method: 'PATCH',
      headers: { 'x-user-id': memberId },
    });
    if (!response.ok) throw new Error(await parseError(response, 'Error al liberar el casillero'));
    return response.json();
  },

  // Eliminar un casillero
  // NUEVO: Método para eliminar un casillero (DELETE)
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