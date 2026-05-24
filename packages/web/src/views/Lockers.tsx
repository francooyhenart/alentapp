import React, { useState, useEffect } from 'react';
import { Box, Heading, Text, SimpleGrid, Badge, Button, VStack, HStack, Input, IconButton } from "@chakra-ui/react";
import { LuTrash2 } from "react-icons/lu"; 
import lockerService from '../services/lockers';
import { membersService } from '../services/members';

interface Locker {
  id: string;
  number: number;
  location: string;
  status: 'Available' | 'Occupied' | 'Maintenance';
  member_id: string | null;
}

interface Member {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

export function LockersView() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [members, setMembers] = useState<Member[]>([]); 
  const [selectedMemberId, setSelectedMemberId] = useState(''); 
  
  const [newNumber, setNewNumber] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const lockersRes = await lockerService.getAll();
      const membersRes = await membersService.getAll();
      
      console.log("Comprobación Directa (Casilleros):", lockersRes);
      console.log("Comprobación Directa (Miembros):", membersRes);

      setLockers(Array.isArray(lockersRes) ? lockersRes : []);
      setMembers(Array.isArray(membersRes) ? membersRes : []);
    } catch (error: any) {
      console.error("Error en fetchData:", error);
      setLockers([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newNumber || !newLocation) return alert("Por favor completá todos los campos");

    setLoading(true);
    try {
      await lockerService.createLocker(Number(newNumber), newLocation);
      alert("¡Casillero creado con éxito!");
      setNewNumber('');
      setNewLocation('');
      await fetchData(); 
    } catch (error: any) {
      alert(error.message || "Error al dar de alta el casillero");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, number: number, status: string) => {
    if (status.toLowerCase() !== 'available') {
      return alert("⚠️ No se puede eliminar un casillero que no esté disponible.");
    }
    if (!window.confirm(`¿Estás segura de que querés eliminar el Casillero #${number}?`)) return;

    setLoading(true);
    try {
      await lockerService.deleteLocker(id);
      await fetchData();
      alert("¡Casillero eliminado con éxito!");
    } catch (error) {
      alert("Error al eliminar el casillero");
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (id: string) => {
    if (!selectedMemberId) {
      return alert("⚠️ Por favor, seleccioná un socio de la lista desplegable antes de reservar.");
    }

    setLoading(true);
    try {
      await lockerService.reserveLocker(id, selectedMemberId);
      await fetchData();
      alert("¡Casillero reservado con éxito!");
    } catch (error) {
      alert("Error al reservar el casillero");
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (id: string, currentMemberId: string | null) => {
    setLoading(true);
    try {
      // Nos aseguramos de pasarle primero el ID del casillero, y después el del socio
      await lockerService.releaseLocker(id, currentMemberId || '');
      alert("¡Casillero liberado correctamente!");
      await fetchData();
    } catch (error) {
      alert("Error al liberar el casillero");
    } finally {
      setLoading(false);
    }
  };
  const handleStatusChange = async (id: string, currentStatus: string, nextStatus: 'Available' | 'Maintenance') => {
    if (currentStatus === 'Occupied') {
      return alert("⚠️ No se puede enviar a mantenimiento un casillero ocupado por un socio.");
    }

    setLoading(true);
    try {
      await lockerService.updateStatus(id, nextStatus);
      await fetchData();
      alert("¡Estado del casillero actualizado!");
    } catch (error: any) {
      alert(error.message || "Error al cambiar el estado");
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

  const formatMemberName = (member: Member | undefined) => {
    if (!member) return null;
    if (member.name) return member.name;
    if (member.firstName || member.lastName) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim();
    }
    return null;
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
          <Button type="submit" colorScheme="blue" isLoading={loading} alignSelf="flex-end" px="6">
            Crear Casillero
          </Button>
        </VStack>
      </Box>

      {/* SELECTOR DE SOCIO ACTIVO */}
      <Box mb="8" p="5" borderWidth="1px" borderRadius="2xl" bg="bg.panel" shadow="sm" maxW="xl">
        <Heading size="sm" mb="3">👤 Selector de Socio para Operaciones</Heading>
        <Text fontSize="xs" color="fg.muted" mb="3">Seleccioná qué socio va a efectuar la reserva antes de tocar el botón del casillero.</Text>
        <select 
          value={selectedMemberId} 
          onChange={(e) => setSelectedMemberId(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '10px', 
            borderRadius: '12px', 
            border: '1px solid #E2E8F0',
            backgroundColor: 'white',
            fontSize: '14px'
          }}
        >
          <option value="">-- Seleccionar socio de la base de datos --</option>
          {members?.map(m => (
            <option key={m.id} value={m.id}>
              {formatMemberName(m) || `Socio ID: ${m.id.substring(0, 8)}...`}
            </option>
          ))}
        </select>
      </Box>
      
      {/* GRILLA DE TARJETAS */}
      <Heading size="md" mb="4">📋 Lista de Casilleros</Heading>
      {lockers.length === 0 ? (
        <Text color="fg.muted" fontStyle="italic">No se encontraron casilleros cargados en el sistema.</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
          {lockers.map((locker) => {
            const badgeInfo = getBadgeProps(locker.status);
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
                      <Text fontSize="xs" color="fg.muted" truncate>
                        👤 Socio: {
                          formatMemberName(members.find(m => m.id === locker.member_id)) || `ID: ${locker.member_id.substring(0, 8)}...`
                        }
                      </Text>
                    </Box>
                  )}
                  
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
                      <Button isLoading={loading} colorScheme="gray" w="full" onClick={() => handleRelease(locker.id, locker.member_id)}>
                        Liberar Casillero
                      </Button>
                    )}
                    {locker.status === 'Maintenance' && (
                      <Button isLoading={loading} colorScheme="green" w="full" onClick={() => handleStatusChange(locker.id, locker.status, 'Available')}>
                        ✅ Rehabilitar Casillero
                      </Button>
                    )}
                  </Box>
                </VStack>
              </Box>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
}