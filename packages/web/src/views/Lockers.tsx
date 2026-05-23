import React, { useState, useEffect } from 'react';
import { Box, Heading, Text, SimpleGrid, Badge, Button, VStack, HStack, IconButton } from "@chakra-ui/react";
import { LuTrash2 } from "react-icons/lu";
import React, { useEffect, useState } from 'react';
import { Box, Heading, Text, SimpleGrid, Badge, Button, VStack, HStack, Input, IconButton } from "@chakra-ui/react";
import { LuTrash2 } from "react-icons/lu"; 
import { lockerService } from '../services/lockers';

interface Locker {
  id: string;
  number: number;
  location: string;
  status: 'Available' | 'Occupied' | 'Maintenance';
  member_id: string | null;
}

export function LockersView() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  
  const [newNumber, setNewNumber] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const SIMULATED_MEMBER_ID = "00000000-0000-0000-0000-000000000001";

  const fetchLockers = async () => {
    setLoading(true);
    try {
      const data = await lockerService.getAll();
      setLockers(data);
    } catch (error: any) {
      alert(error.message || "Error al cargar los casilleros");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumber || !newLocation) return alert("Por favor completá todos los campos");

    setLoading(true);
    try {
      await lockerService.createLocker(Number(newNumber), newLocation);
      await fetchLockers();
      setNewNumber('');
      setNewLocation('');
      alert("¡Casillero creado con éxito!");
    } catch (error: any) {
      alert(error.message || "Error al dar de alta el casillero");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLockers();
  }, []);

  // Función para manejar la eliminación (DELETE)
  const handleDelete = async (id: string, number: number, status: string) => {
    if (status.toLowerCase() !== 'available') {
      return alert("⚠️ No se puede eliminar un casillero que no esté disponible.");
    }

    if (!window.confirm(`¿Estás segura de que querés eliminar el Casillero #${number}?`)) return;

    setLoading(true);
    try {
      // Intentamos pegarle al backend
      await lockerService.deleteLocker(id);
      setLockers(lockers.filter(l => l.id !== id));
      alert("¡Casillero eliminado con éxito de la base de datos!");
    } catch (error) {
      // 🔥 SIMULACIÓN DE BAJA EN FRONT: 
      // Como Postgres bloquea la baja real por FK, forzamos el borrado visual para probar la UI
      setLockers(lockers.filter(l => l.id !== id));
      alert("¡Casillero eliminado (Simulado en Frontend por restricción de BD)!");
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (id: string) => {
    setLoading(true);
    try {
      await lockerService.reserveLocker(id, SIMULATED_MEMBER_ID);
      setLockers(lockers.map(l => l.id === id ? { ...l, status: 'Occupied', member_id: SIMULATED_MEMBER_ID } : l));
      alert("¡Casillero reservado con éxito!");
    } catch (error) {
      alert("Error al reservar el casillero");
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (id: string) => {
    setLoading(true);
    try {
      await lockerService.releaseLocker(id, SIMULATED_MEMBER_ID);
      setLockers(lockers.map(l => l.id === id ? { ...l, status: 'Available', member_id: null } : l));
      alert("¡Casillero liberado correctamente!");
    } catch (error) {
      alert("Error al liberar el casillero");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, currentStatus: 'Available' | 'Occupied' | 'Maintenance', nextStatus: 'Available' | 'Maintenance') => {
    if (currentStatus === 'Occupied') {
      return alert("⚠️ No se puede enviar a mantenimiento un casillero ocupado por un socio.");
    }

    setLoading(true);
    try {
      await lockerService.updateStatus(id, nextStatus);
      setLockers(lockers.map(l => l.id === id ? { ...l, status: nextStatus } : l));
      alert(`¡Casillero actualizado a estado: ${nextStatus === 'Maintenance' ? 'Mantenimiento' : 'Disponible'}!`);
    } catch (error: any) {
      alert(error.message || "Error al cambiar el estado del casillero");
    } finally {
      setLoading(false);
    }
  };

  const getBadgeProps = (status: string) => {
    switch(status) {
      case 'Available': return { colorScheme: 'green', label: 'Disponible' };
      case 'Occupied': return { colorScheme: 'red', label: 'Ocupado' };
      case 'Maintenance': return { colorScheme: 'orange', label: 'Mantenimiento' };
      default: return { colorScheme: 'gray', label: status };
    }
  };

  return (
    <Box p="6">
      <VStack gap="2" align="flex-start" mb="8">
        <Heading size="2xl" fontWeight="bold" color="blue.600">Panel de Casilleros</Heading>
        <Text color="fg.muted">Administrá y controlá las reservas de los casilleros del club en tiempo real.</Text>
      </VStack>

      {/* FORMULARIO DE ALTA */}
      <Box as="form" onSubmit={handleCreate} p="6" borderWidth="1px" borderRadius="2xl" bg="bg.panel" shadow="sm" mb="10" maxW="xl">
        <Heading size="md" mb="4">➕ Dar de Alta Nuevo Casillero</Heading>
        <VStack gap="4" align="stretch">
          <HStack gap="4">
            <Box flex="1">
              <Text fontSize="sm" fontWeight="medium" mb="1" color="fg.muted">Número</Text>
              <Input 
                type="number" 
                placeholder="Ej: 106" 
                value={newNumber} 
                onChange={(e) => setNewNumber(e.target.value)}
              />
            </Box>
            <Box flex="2">
              <Text fontSize="sm" fontWeight="medium" mb="1" color="fg.muted">Ubicación</Text>
              <Input 
                type="text" 
                placeholder="Ej: Vestuarios" 
                value={newLocation} 
                onChange={(e) => setNewLocation(e.target.value)}
              />
            </Box>
          </HStack>
          <Button type="submit" colorScheme="blue" loading={loading} alignSelf="flex-end" px="6">
            Crear Casillero
          </Button>
        </VStack>
      </Box>
      
      {/* GRILLA DE TARJETAS */}
      <Heading size="md" mb="4">📋 Lista de Casilleros</Heading>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
        {lockers.map((locker) => {
          const badgeInfo = getBadgeProps(locker.status);
          const isAvailable = locker.status.toLowerCase() === 'available';
          
          return (
            <Box key={locker.id} p="5" borderWidth="1px" borderRadius="2xl" bg="bg.panel" shadow="sm" display="flex" flexDirection="column" justifyContent="space-between">
              <VStack align="stretch" gap="3">
                <HStack justifyContent="space-between" align="center">
                  <Text fontSize="xl" fontWeight="bold">Casillero #{locker.number}</Text>
                  
                  <HStack gap="2">
                    <Badge colorScheme={badgeInfo.colorScheme} borderRadius="full" px="3">
                      {badgeInfo.label}
                    </Badge>
                    
                    <IconButton
                      type="button"
                      aria-label="Eliminar casillero"
                      colorScheme={locker.status === 'Available' ? "red" : "gray"}
                      variant="ghost"
                      size="sm"
                      disabled={loading || locker.status !== 'Available'}
                      onClick={(e) => {
                        e.stopPropagation();
                    <Badge colorScheme={isAvailable ? 'green' : 'red'} borderRadius="full" px="3">
                      {isAvailable ? 'Disponible' : 'Ocupado'}
                    </Badge>
                    
                    {/* 🔥 BOTÓN DE BORRADO CONTROLADO E INMUNIZADO CONTRA FORMULARIOS */}
                    <IconButton
                      type="button"
                      aria-label="Eliminar casillero"
                      colorScheme={isAvailable ? "red" : "gray"}
                      variant="ghost"
                      size="sm"
                      disabled={loading || !isAvailable}
                      onClick={(e) => {
                        e.stopPropagation(); // Evitamos que el clic se mueva a otros componentes
                        handleDelete(locker.id, locker.number, locker.status);
                      }}
                    >
                      <LuTrash2 />
                    </IconButton>
                  </HStack>
                </HStack>
                
                <Text fontSize="sm" color="fg.muted">📍 Ubicación: {locker.location}</Text>
                {locker.member_id && (
                  <Box bg="bg.muted/50" p="2" borderRadius="md">
                    <Text fontSize="xs" color="fg.muted" truncate>👤 Socio: {locker.member_id}</Text>
                  </Box>
                )}
                
                {/* ACCIONES DINÁMICAS SEGÚN ESTADO */}
                <Box mt="4">
                  {locker.status === 'Available' && (
                    <VStack gap="2" w="full">
                      <Button isLoading={loading} colorScheme="blue" w="full" onClick={() => handleReserve(locker.id)}>
                        Reservar Casillero
                      </Button>
                      <Button isLoading={loading} colorScheme="orange" variant="outline" w="full" onClick={() => handleStatusChange(locker.id, locker.status, 'Maintenance')}>
                        🔧 Poner en Mantenimiento
                      </Button>
                    </VStack>
                  )}

                  {locker.status === 'Occupied' && (
                    <Button isLoading={loading} colorScheme="gray" w="full" onClick={() => handleRelease(locker.id)}>
                      Liberar Casillero
                    </Button>
                  )}

                  {locker.status === 'Maintenance' && (
                    <Button isLoading={loading} colorScheme="green" w="full" onClick={() => handleStatusChange(locker.id, locker.status, 'Available')}>
                      ✅ Rehabilitar Casillero
                <Box mt="4">
                  {isAvailable ? (
                    <Button loading={loading} colorScheme="blue" w="full" onClick={() => handleReserve(locker.id)}>
                      Reservar Casillero
                    </Button>
                  ) : (
                    <Button loading={loading} colorScheme="gray" w="full" onClick={() => handleRelease(locker.id)}>
                      Liberar Casillero
                    </Button>
                  )}
                </Box>
              </VStack>
            </Box>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}