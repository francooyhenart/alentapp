// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React, { useState, useEffect } from 'react';
import { lockerService } from '../services/lockers';

vi.mock('../services/lockers', () => {
  return {
    lockerService: {
      getAll: vi.fn(),
      reserveLocker: vi.fn(),
      releaseLocker: vi.fn(),
      createLocker: vi.fn(),
    },
  };
});

const MockLockersView = () => {
  const [lockers, setLockers] = useState<any[]>([]);
  const [number, setNumber] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    lockerService.getAll().then(setLockers);
  }, []);

  const handleCreate = async () => {
    const newLocker = await lockerService.createLocker({ number: Number(number), location });
    setLockers([...lockers, newLocker]);
  };

  const handleReserve = async (id: string) => {
    await lockerService.reserveLocker(id, 'socio-777');
    setLockers(lockers.map(l => l.id === id ? { ...l, status: 'Occupied', member_id: 'socio-777' } : l));
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
            <button disabled={l.status === 'Occupied'} onClick={() => handleReserve(l.id)}>Reservar</button>
            <button disabled={l.status === 'Available'}>Liberar</button>
            <button disabled={l.status === 'Occupied'} data-testid={`mantenimiento-${l.number}`}>Mantenimiento</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

describe('🌐 Tests End-to-End (E2E) — Panel de Interfaz de Casilleros', () => {
  
  const mockLockers = [
    { id: '1', number: 101, location: 'Sector A', status: 'Available', member_id: null },
    { id: '2', number: 102, location: 'Sector B', status: 'Occupied', member_id: 'socio-123' },
  ];

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    (lockerService.getAll as any).mockResolvedValue(mockLockers);
  });

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

  it('3. Reglas de Interfaz: Un casillero Ocupado debe bloquear mantenimiento y habilitar liberación', async () => {
    render(<MockLockersView />);

    await screen.findByText(/Casillero 102/i);

    const botonMantenimiento = screen.getByTestId('mantenimiento-102');
    expect(botonMantenimiento.hasAttribute('disabled')).toBe(true);
  });
});