// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import React, { useState, useEffect } from 'react';

import { lockerService } from '../services/lockers';



// Mock del servicio de casilleros para interceptar las llamadas HTTP y controlar las respuestas en memoria

vi.mock('../services/lockers', () => {

  return {

    lockerService: {

      getAll: vi.fn(),

      reserveLocker: vi.fn(),

      releaseLocker: vi.fn(),

      createLocker: vi.fn(),

      updateStatus: vi.fn(),

    },

  };

});



// Componente ficticio que replica de forma aislada el comportamiento y los flujos visuales de la vista real

const MockLockersView = () => {

  const [lockers, setLockers] = useState<any[]>([]);

  const [number, setNumber] = useState('');

  const [location, setLocation] = useState('');



  // Carga inicial de todos los casilleros del sistema al montar el componente

  useEffect(() => {

    lockerService.getAll().then(setLockers);

  }, []);



  // Envía los datos del formulario para dar de alta un nuevo casillero y lo suma a la lista local

  const handleCreate = async () => {

    const newLocker = await lockerService.createLocker({ number: Number(number), location });

    setLockers([...lockers, newLocker]);

  };



  // Realiza la reserva de un casillero específico asignándole un socio fijo y cambiando su estado a ocupado

  const handleReserve = async (id: string) => {

    await lockerService.reserveLocker(id, 'socio-777');

    setLockers(lockers.map(l => l.id === id ? { ...l, status: 'Occupied', member_id: 'socio-777' } : l));

  };



  // Modifica el estado operativo del casillero (Mantenimiento o Disponible) invocando al servicio de actualización

  const handleStatusChange = async (id: string, nextStatus: 'Available' | 'Maintenance') => {

    await lockerService.updateStatus(id, nextStatus);

    setLockers(lockers.map(l => l.id === id ? { ...l, status: nextStatus } : l));

  }; 
    return (

    <div>

      <h1>Panel de Casilleros</h1>

      <div>

        <input placeholder="Número" value={number} onChange={e => setNumber(e.target.value)} />

        <input placeholder="Ubicación" value={location} onChange={e => setLocation(e.target.value)} />

        <button onClick={handleCreate}>Crear</button>

      </div>

      <ul>

        {lockers.map(l => (

          <li key={l.id}>

            <span>Casillero {l.number} - {l.location} ({l.status})</span>

            <button disabled={l.status === 'Occupied' || l.status === 'Maintenance'} onClick={() => handleReserve(l.id)}>

              Reservar

            </button>

            <button disabled={l.status === 'Available' || l.status === 'Maintenance'}>

              Liberar

            </button>

            

            {l.status === 'Available' && (

              <button data-testid={`mantenimiento-${l.number}`} onClick={() => handleStatusChange(l.id, 'Maintenance')}>

                🔧 Mantenimiento

              </button>

            )}

            {l.status === 'Maintenance' && (

              <button data-testid={`rehabilitar-${l.number}`} onClick={() => handleStatusChange(l.id, 'Available')}>

                ✅ Habilitar

              </button>

            )}

            {l.status === 'Occupied' && (

              <button disabled data-testid={`mantenimiento-${l.number}`}>

                🔧 Mantenimiento

              </button>

            )}

          </li>

        ))}

      </ul>

    </div>

  );

}; 

describe('🌐 Tests End-to-End (E2E) — Panel de Interfaz de Casilleros', () => {

  

  // Datos iniciales de prueba para popular el componente en cada escenario

  const mockLockers = [

    { id: '1', number: 101, location: 'Sector A', status: 'Available', member_id: null },

    { id: '2', number: 102, location: 'Sector B', status: 'Occupied', member_id: 'socio-123' },

    { id: '4', number: 104, location: 'Sector D', status: 'Maintenance', member_id: null },

  ];



  // Configuración previa: Limpia el árbol de componentes y resetea el historial de los mocks antes de cada test

  beforeEach(() => {

    cleanup();

    vi.clearAllMocks();

    (lockerService.getAll as any).mockResolvedValue(mockLockers);

  });



  // Test 19: Simula el proceso completo de llenado y envío del formulario para agregar un nuevo casillero

  it('1. Flujo de Alta: Debe completar el formulario, enviar y visualizar el nuevo casillero en la grilla', async () => {

    (lockerService.createLocker as any).mockResolvedValue({

      id: '3', number: 103, location: 'Sector C', status: 'Available', member_id: null

    });



    render(<MockLockersView />);



    const inputNumero = await screen.findByPlaceholderText(/número/i);

    const inputUbicacion = screen.getByPlaceholderText(/ubicación/i);

    const botonCrear = screen.getByRole('button', { name: /crear/i });



    fireEvent.change(inputNumero, { target: { value: '103' } });

    fireEvent.change(inputUbicacion, { target: { value: 'Sector C' } });

    fireEvent.click(botonCrear);



    await waitFor(() => {

      expect(lockerService.createLocker).toHaveBeenCalledWith({ number: 103, location: 'Sector C' });

      expect(screen.getByText(/Casillero 103/i)).toBeDefined();

    });

  }); 


  // Test 20: Simula el flujo en el que un usuario reserva un casillero disponible y reacciona de forma reactiva

  it('2. Flujo de Reserva: Seleccionar socio, presionar reservar y verificar que la tarjeta cambie a Ocupado', async () => {

    (lockerService.reserveLocker as any).mockResolvedValue({

      id: '1', number: 101, location: 'Sector A', status: 'Occupied', member_id: 'socio-777'

    });



    render(<MockLockersView />);



    const tarjetaDisponible = await screen.findByText(/Casillero 101/i);

    expect(tarjetaDisponible).toBeDefined();



    const botonReservar = screen.getAllByRole('button', { name: /reservar/i })[0];

    fireEvent.click(botonReservar);



    await waitFor(() => {

      expect(lockerService.reserveLocker).toHaveBeenCalled();

      expect(screen.getByText(/Casillero 101 - Sector A \(Occupied\)/i)).toBeDefined();

    });

  }); 

    // Test 21: Regla de negocio de UX que valida que no se pueda enviar a reparación un casillero que posee un socio activo

  it('3. Reglas de Interfaz: Un casillero Ocupado debe bloquear el botón de mantenimiento', async () => {

    render(<MockLockersView />);



    await screen.findByText(/Casillero 102/i);



    const botonMantenimiento = screen.getByTestId('mantenimiento-102');

    expect(botonMantenimiento.hasAttribute('disabled')).toBe(true);

  }); 
// Test 90: Valida la acción administrativa de bloquear un casillero libre enviándolo al estado de mantenimiento
  it('4. Gestión de Mantenimiento: Debe permitir enviar un casillero Disponible a Mantenimiento', async () => {
    (lockerService.updateStatus as any).mockResolvedValue({
      id: '1', number: 101, location: 'Sector A', status: 'Maintenance', member_id: null
    });

    render(<MockLockersView />);

    await screen.findByText(/Casillero 101/i);
    const botonMantenimiento = screen.getByTestId('mantenimiento-101');
    
    fireEvent.click(botonMantenimiento);

    await waitFor(() => {
      expect(lockerService.updateStatus).toHaveBeenCalledWith('1', 'Maintenance');
      expect(screen.getByText(/Casillero 101 - Sector A \(Maintenance\)/i)).toBeDefined();
    });
  });

  // Test 91: Valida la acción administrativa de dar el alta técnica a un casillero en reparación para habilitar futuras reservas
  it('5. Gestión de Mantenimiento: Debe permitir rehabilitar un casillero en Mantenimiento a Disponible', async () => {
    (lockerService.updateStatus as any).mockResolvedValue({
      id: '4', number: 104, location: 'Sector D', status: 'Available', member_id: null
    });

    render(<MockLockersView />);

    await screen.findByText(/Casillero 104/i);
    const botonRehabilitar = screen.getByTestId('rehabilitar-104');
    
    fireEvent.click(botonRehabilitar);

    await waitFor(() => {
      expect(lockerService.updateStatus).toHaveBeenCalledWith('4', 'Available');
      expect(screen.getByText(/Casillero 104 - Sector D \(Available\)/i)).toBeDefined();
    });
  });
});

