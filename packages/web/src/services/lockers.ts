const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

const lockerService = {
  // 1. Traer todos los casilleros
  async getAll() {
    const response = await fetch(`${API_URL}/lockers`);
    if (!response.ok) {
      throw new Error('Error al obtener los casilleros');
    }
    return await response.json(); 
  },

  // 2. Crear un nuevo casillero
  async createLocker(number: number, location: string) {
    const response = await fetch(`${API_URL}/lockers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, location })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear el casillero');
    }
    return await response.json();
  },

 // 3. Reservar un casillero
  async reserveLocker(id: string, memberId: string) {
    const response = await fetch(`${API_URL}/lockers/${id}/reserve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al reservar el casillero');
    }
    return await response.json();
  },

  // 4. Liberar un casillero (Agregamos la cabecera x-user-id requerida por Fastify)
  async releaseLocker(id: string, memberId: string) {
    const response = await fetch(`${API_URL}/lockers/${id.trim()}/release`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': memberId // Satisface la validación del backend
      },
      body: JSON.stringify({ member_id: memberId, session_member_id: memberId })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al liberar el casillero');
    }
    return await response.json();
  },

  // 5. Cambiar estado
  async updateStatus(id: string, status: 'Available' | 'Maintenance') {
    const response = await fetch(`${API_URL}/lockers/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al cambiar el estado');
    }
    return await response.json();
  },

  // 6. Eliminar un casillero
  async deleteLocker(id: string) {
    const response = await fetch(`${API_URL}/lockers/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar el casillero');
    }
  }
};

export default lockerService;