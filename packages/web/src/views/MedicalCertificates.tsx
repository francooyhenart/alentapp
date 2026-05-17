import { 
    Table, 
    Button, 
    Heading, 
    HStack, 
    Stack, 
    Text, 
    Box,
    Flex,
    Spinner,
    Center,
} from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { useEffect, useState } from "react";
import { medicalCertificatesService } from "../services/medicalCertificates";
import type { MedicalCertificateDTO } from "@alentapp/shared";

export function MedicalCertificatesView() {
    const [certificates, setCertificates] = useState<MedicalCertificateDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCertificates = async () => {
        setIsLoading(true);
        setError(null);
        try {
        const data = await medicalCertificatesService.getAll();
        setCertificates(data);
    } catch (err: any) {
        setError(err.message || "Error al cargar los certificados médicos");
    } finally {
        setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCertificates();
    }, []);

    return (
        <Stack gap="8">
        <Flex justify="space-between" align="center">
            <Stack gap="1">
            <Heading size="2xl" fontWeight="bold">Certificados Médicos</Heading>
            <Text color="fg.muted" fontSize="md">
                Gestiona los certificados médicos de los socios del club.
            </Text>
            </Stack>
            <HStack gap="3">
            <Button variant="outline" onClick={fetchCertificates} disabled={isLoading}>
                <LuRefreshCw /> Actualizar
            </Button>
            </HStack>
        </Flex>

        {error && (
            <Box p="4" bg="red.50" color="red.700" borderRadius="md" border="1px solid" borderColor="red.200">
                <Text fontWeight="bold">Error:</Text>
                <Text>{error}</Text>
            </Box>
        )}

        <Box 
            bg="bg.panel" 
            borderRadius="xl" 
            boxShadow="sm" 
            borderWidth="1px" 
            overflow="hidden"
            minH="300px"
            position="relative"
        >
            {isLoading ? (
            <Center h="300px">
                <Stack align="center" gap="4">
                <Spinner size="xl" color="blue.500" />
                <Text color="fg.muted">Cargando certificados...</Text>
                </Stack>
            </Center>
            ) : certificates.length === 0 ? (
            <Center h="300px">
                <Stack align="center" gap="4">
                <Text color="fg.muted">No se encontraron certificados médicos.</Text>
                <Button variant="ghost" onClick={fetchCertificates}>Reintentar</Button>
                </Stack>
            </Center>
            ) : (
            <Table.Root size="md" variant="line" interactive>
                <Table.Header>
                <Table.Row bg="bg.muted/50">
                    <Table.ColumnHeader py="4">Socio (ID)</Table.ColumnHeader>
                    <Table.ColumnHeader py="4">Fecha Emisión</Table.ColumnHeader>
                    <Table.ColumnHeader py="4">Fecha Vencimiento</Table.ColumnHeader>
                    <Table.ColumnHeader py="4">Matrícula Médica</Table.ColumnHeader>
                    <Table.ColumnHeader py="4">Estado</Table.ColumnHeader>
                </Table.Row>
                </Table.Header>
                <Table.Body>
                {certificates.map((cert) => (
                    <Table.Row key={cert.id} _hover={{ bg: "bg.muted/30" }}>
                    <Table.Cell fontWeight="semibold" color="fg.emphasized" fontSize="xs" fontFamily="mono">
                        {cert.memberId}
                    </Table.Cell>
                    <Table.Cell color="fg.muted">{cert.issueDate}</Table.Cell>
                    <Table.Cell color="fg.muted">{cert.expiryDate}</Table.Cell>
                    <Table.Cell color="fg.muted">{cert.doctorLicense}</Table.Cell>
                    <Table.Cell>
                        <Box 
                        display="inline-block" 
                        px="2" 
                        py="0.5" 
                        borderRadius="md" 
                        bg={cert.isValidated ? 'green.50' : 'orange.50'} 
                        color={cert.isValidated ? 'green.700' : 'orange.700'} 
                        fontSize="xs" 
                        fontWeight="bold"
                        >
                        {cert.isValidated ? 'Validado' : 'Pendiente'}
                        </Box>
                    </Table.Cell>
                    </Table.Row>
                ))}
                </Table.Body>
            </Table.Root>
            )}
        </Box>
        </Stack>
    );
}