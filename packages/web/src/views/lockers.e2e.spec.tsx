// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { within } from '@testing-library/dom';
import { LockersView } from './Lockers';
import lockerService from '../services/lockers';
import { membersService } from '../services/members';
import { Provider } from '../components/ui/provider';

const serviceMocks = vi.hoisted(() => ({
  lockerService: {
    getAll: vi.fn(),
    reserveLocker: vi.fn(),
    releaseLocker: vi.fn(),
    createLocker: vi.fn(),
    updateStatus: vi.fn(),
    deleteLocker: vi.fn(),
  },
  membersService: {
    getAll: vi.fn(),
  },
}));

vi.mock('../services/lockers', () => ({
  default: serviceMocks.lockerService,
}));

vi.mock('../services/members', () => ({
  membersService: serviceMocks.membersService,
}));

describe('Tests End-to-End (E2E) - Panel de Interfaz de Casilleros', () => {
  const mockMembers = [
    { id: 'socio-777', name: 'Socio Reserva' },
    { id: 'socio-123', name: 'Socio Ocupado' },
  ];

  const mockLockers = [
    { id: '1', number: 101, location: 'Sector A', status: 'Available', member_id: null },
    { id: '2', number: 102, location: 'Sector B', status: 'Occupied', member_id: 'socio-123' },
    { id: '4', number: 104, location: 'Sector D', status: 'Maintenance', member_id: null },
  ];

  const renderWithProviders = () => render(
    <Provider>
      <LockersView />
    </Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(membersService.getAll).mockResolvedValue(mockMembers as any);
    vi.mocked(lockerService.getAll).mockResolvedValue(mockLockers as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // Test 19: Simula el proceso completo de llenado y envio del formulario para agregar un nuevo casillero
  it('1. Flujo de Alta: Debe completar el formulario, enviar y visualizar el nuevo casillero en la grilla', async () => {
    const lockersAfterCreate = [
      ...mockLockers,
      { id: '3', number: 103, location: 'Sector C', status: 'Available', member_id: null },
    ];

    vi.mocked(lockerService.getAll)
      .mockResolvedValueOnce(mockLockers as any)
      .mockResolvedValueOnce(lockersAfterCreate as any);
    vi.mocked(lockerService.createLocker).mockResolvedValueOnce(lockersAfterCreate[3] as any);

    renderWithProviders();

    await screen.findByText('Casillero #101');

    fireEvent.change(screen.getByPlaceholderText('Ej: 106'), { target: { value: '103' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Vestuarios'), { target: { value: 'Sector C' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Casillero/i }));

    await waitFor(() => {
      expect(lockerService.createLocker).toHaveBeenCalledWith(103, 'Sector C');
      expect(screen.getByText('Casillero #103')).toBeDefined();
    });
  });

  // Test 20: Simula el flujo en el que un usuario reserva un casillero disponible y reacciona de forma reactiva
  it('2. Flujo de Reserva: Seleccionar socio, presionar reservar y verificar que la tarjeta cambie a Ocupado', async () => {
    const lockersAfterReserve = mockLockers.map((locker) =>
      locker.id === '1' ? { ...locker, status: 'Occupied', member_id: 'socio-777' } : locker
    );

    vi.mocked(lockerService.getAll)
      .mockResolvedValueOnce(mockLockers as any)
      .mockResolvedValueOnce(lockersAfterReserve as any);
    vi.mocked(lockerService.reserveLocker).mockResolvedValueOnce(lockersAfterReserve[0] as any);

    renderWithProviders();

    await screen.findByText('Casillero #101');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'socio-777' } });
    fireEvent.click(screen.getByRole('button', { name: /Reservar Casillero/i }));

    await waitFor(() => {
      expect(lockerService.reserveLocker).toHaveBeenCalledWith('1', 'socio-777');
      expect(screen.getAllByText('Ocupado').length).toBeGreaterThanOrEqual(2);
    });
  });

  // Test 21: Regla de negocio de UX que valida que no se pueda enviar a reparacion un casillero que posee un socio activo
  it('3. Reglas de Interfaz: Un casillero Ocupado no debe mostrar accion de mantenimiento', async () => {
    renderWithProviders();

    const occupiedTitle = await screen.findByText('Casillero #102');
    const occupiedCard = occupiedTitle.closest('[class]')?.parentElement?.parentElement?.parentElement;

    expect(screen.getByText('Socio Ocupado')).toBeDefined();
    expect(occupiedCard).toBeTruthy();
    expect(within(occupiedCard as HTMLElement).getByRole('button', { name: /Liberar Casillero/i })).toBeDefined();
    expect(within(occupiedCard as HTMLElement).queryByRole('button', { name: /Poner en Mantenimiento/i })).toBeNull();
  });

  // Test 90: Valida la accion administrativa de bloquear un casillero libre enviandolo al estado de mantenimiento
  it('4. Gestion de Mantenimiento: Debe permitir enviar un casillero Disponible a Mantenimiento', async () => {
    const lockersAfterMaintenance = mockLockers.map((locker) =>
      locker.id === '1' ? { ...locker, status: 'Maintenance' } : locker
    );

    vi.mocked(lockerService.getAll)
      .mockResolvedValueOnce(mockLockers as any)
      .mockResolvedValueOnce(lockersAfterMaintenance as any);
    vi.mocked(lockerService.updateStatus).mockResolvedValueOnce(lockersAfterMaintenance[0] as any);

    renderWithProviders();

    await screen.findByText('Casillero #101');
    fireEvent.click(screen.getByRole('button', { name: /Poner en Mantenimiento/i }));

    await waitFor(() => {
      expect(lockerService.updateStatus).toHaveBeenCalledWith('1', 'Maintenance');
      expect(screen.getAllByText('Mantenimiento').length).toBeGreaterThanOrEqual(2);
    });
  });

  // Test 91: Valida la accion administrativa de dar el alta tecnica a un casillero en reparacion para habilitar futuras reservas
  it('5. Gestion de Mantenimiento: Debe permitir rehabilitar un casillero en Mantenimiento a Disponible', async () => {
    const lockersAfterRehab = mockLockers.map((locker) =>
      locker.id === '4' ? { ...locker, status: 'Available' } : locker
    );

    vi.mocked(lockerService.getAll)
      .mockResolvedValueOnce(mockLockers as any)
      .mockResolvedValueOnce(lockersAfterRehab as any);
    vi.mocked(lockerService.updateStatus).mockResolvedValueOnce(lockersAfterRehab[2] as any);

    renderWithProviders();

    await screen.findByText('Casillero #104');
    fireEvent.click(screen.getByRole('button', { name: /Rehabilitar Casillero/i }));

    await waitFor(() => {
      expect(lockerService.updateStatus).toHaveBeenCalledWith('4', 'Available');
      expect(screen.getAllByText('Disponible').length).toBeGreaterThanOrEqual(2);
    });
  });
});
