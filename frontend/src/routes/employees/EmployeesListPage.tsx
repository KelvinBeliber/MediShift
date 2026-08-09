import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Pagination } from '@/components/data/Pagination'
import { DepartmentBadge } from '@/components/data/DepartmentBadge'
import { EmployeeStatusBadge } from '@/features/employees/EmployeeStatusBadge'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { usePermission } from '@/features/auth/usePermission'
import { employeesApi } from '@/features/employees/api'
import { departmentsApi } from '@/features/departments/api'
import { positionsApi } from '@/features/positions/api'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toApiError } from '@/lib/api/errors'
import { applyFieldErrors } from '@/lib/api/errors'

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'per_diem', 'intern'] as const

const createSchema = z.object({
  employeeId: z.string().trim().optional(),
  firstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  email: z.string().trim().email('Enter a valid email'),
  department: z.string().optional(),
  position: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  hireDate: z.string().min(1, 'Required'),
})

type CreateValues = z.infer<typeof createSchema>

const STATUS_OPTIONS = ['active', 'inactive', 'on_leave', 'terminated'] as const

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Screen 7 — `/employees`. */
export function EmployeesListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canCreate = usePermission('employee:create')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', { search: debouncedSearch, status, page }],
    queryFn: () =>
      employeesApi.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        page,
        limit: 20,
      }),
  })

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    enabled: createOpen,
  })
  const { data: positionsData } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.list(),
    enabled: createOpen,
  })

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      position: '',
      employmentType: 'full_time',
      hireDate: '',
    },
  })

  const create = useMutation({
    mutationFn: (values: CreateValues) =>
      employeesApi.create({
        employeeId: values.employeeId || undefined,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        department: values.department || undefined,
        position: values.position || undefined,
        employmentType: values.employmentType,
        hireDate: values.hireDate,
      }),
    onSuccess: (employee) => {
      toast.success(`Employee ${employee.employeeId} created`)
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      setCreateOpen(false)
      form.reset()
    },
    onError: (error) => {
      if (applyFieldErrors(error, form.setError)) return
      toast.error(toApiError(error).message)
    },
  })

  const employees = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Search, filter, and manage hospital staff records."
        actions={
          canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon /> Add employee
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-64">
          <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          value={status || 'all'}
          onValueChange={(v) => {
            setStatus(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && employees.length === 0 && (
        <EmptyState title="No employees found" description="Try a different search or filter." />
      )}

      {employees.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Employment type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer"
                  onClick={() => void navigate(`/employees/${employee.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarImage src={employee.photo} alt="" />
                        <AvatarFallback>
                          {initials(employee.fullName ?? `${employee.firstName} ${employee.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      {employee.fullName ?? `${employee.firstName} ${employee.lastName}`}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{employee.employeeId}</TableCell>
                  <TableCell>
                    {employee.department ? (
                      <DepartmentBadge id={employee.department.id} name={employee.department.name} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{employee.position?.title ?? '—'}</TableCell>
                  <TableCell className="capitalize">{employee.employmentType.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <EmployeeStatusBadge status={employee.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && <Pagination meta={data.pagination} onPageChange={setPage} />}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Auto-generated if left blank" className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormDescription>
                      The employee will use this exact address to claim their login later.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(departmentsData?.items ?? []).map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position</FormLabel>
                      <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(positionsData?.items ?? []).map((pos) => (
                            <SelectItem key={pos.id} value={pos.id}>
                              {pos.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EMPLOYMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type} className="capitalize">
                              {type.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hireDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hire date</FormLabel>
                      <FormControl>
                        <DatePicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create employee'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
