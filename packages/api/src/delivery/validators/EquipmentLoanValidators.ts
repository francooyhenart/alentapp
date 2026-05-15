import { z } from 'zod';

export const createEquipmentLoanSchema = z.object({
  body: z.object({
    itemName: z
      .string({
        required_error: 'El nombre del ítem es requerido'
      })
      .min(3, 'El nombre del ítem debe tener al menos 3 caracteres')
      .max(255, 'El nombre del ítem no puede exceder 255 caracteres')
      .trim(),
    
    memberId: z
      .string({
        required_error: 'El ID del socio es requerido'
      })
      .uuid('El ID del socio debe ser un UUID válido'),
    
    notes: z
      .string()
      .max(1000, 'Las notas no pueden exceder 1000 caracteres')
      .trim()
      .optional()
  })
});

export type CreateEquipmentLoanBody = z.infer<typeof createEquipmentLoanSchema>['body'];
