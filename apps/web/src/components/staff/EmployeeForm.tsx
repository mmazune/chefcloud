import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const salaryTypes = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'PER_SHIFT', label: 'Per Shift' },
];

const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  branchId: z.string().min(1, 'Branch is required'),
  salaryType: z.enum(['MONTHLY', 'DAILY', 'HOURLY', 'PER_SHIFT']).optional(),
  baseSalaryAmount: z.number().min(0, 'Salary must be positive').optional(),
  isActive: z.boolean().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
  initialData?: Partial<EmployeeFormData>;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function EmployeeForm({ initialData, onSubmit, onCancel, isSubmitting }: EmployeeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      branchId: '',
      salaryType: 'MONTHLY',
      baseSalaryAmount: 0,
      isActive: true,
      ...initialData,
    },
  });

  useEffect(() => {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        setValue(key as keyof EmployeeFormData, value as any);
      });
    }
  }, [initialData, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <Input {...register('firstName')} />
          {errors.firstName && (
            <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <Input {...register('lastName')} />
          {errors.lastName && (
            <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <Input type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Phone</label>
        <Input {...register('phone')} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Position/Role</label>
        <Input {...register('position')} placeholder="e.g., Waiter, Chef, Manager" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Branch ID <span className="text-red-500">*</span>
        </label>
        <Input {...register('branchId')} placeholder="Enter branch ID" />
        {errors.branchId && (
          <p className="text-sm text-red-500 mt-1">{errors.branchId.message}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          TODO: Replace with branch dropdown
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Salary Type</label>
          <Select {...register('salaryType')}>
            {salaryTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Base Salary Amount</label>
          <Input
            type="number"
            step="0.01"
            {...register('baseSalaryAmount', { valueAsNumber: true })}
            placeholder="0"
          />
          {errors.baseSalaryAmount && (
            <p className="text-sm text-red-500 mt-1">{errors.baseSalaryAmount.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          {...register('isActive')}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="isActive" className="text-sm font-medium">
          Active Employee
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : initialData ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
}
