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


