import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeftIcon, ArrowUpTrayIcon, DocumentTextIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { usePermission } from '@/features/auth/usePermission'
import { employeesApi } from '@/features/employees/api'
import { DOCUMENT_TYPES } from '@/features/employees/types'
import { departmentsApi } from '@/features/departments/api'
import { positionsApi } from '@/features/positions/api'
import { toApiError } from '@/lib/api/errors'

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'per_diem', 'intern'] as const
const STATUSES = ['active', 'inactive', 'on_leave', 'terminated'] as const

const editSchema = z.object({
  firstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(STATUSES),
  salary: z.string().trim().optional(),
})

type EditValues = z.infer<typeof editSchema>

/** Screen 8 — `/employees/:id`. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canEdit = usePermission('employee:edit')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadType, setUploadType] = useState<string>('other')

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employees', id],
    queryFn: () => employeesApi.get(id),
    enabled: Boolean(id),
  })
  const { data: departmentsData } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() })
  const { data: positionsData } = useQuery({ queryKey: ['positions'], queryFn: () => positionsApi.list() })
  const { data: documents } = useQuery({
    queryKey: ['employees', id, 'documents'],
    queryFn: () => employeesApi.documents(id),
    enabled: Boolean(id),
  })

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: employee
      ? {
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone ?? '',
          department: employee.department?.id ?? '',
          position: employee.position?.id ?? '',
          employmentType: employee.employmentType,
          status: employee.status,
          salary: employee.salary !== undefined ? String(employee.salary) : '',
        }
      : undefined,
  })

  const save = useMutation({
    mutationFn: (values: EditValues) =>
      employeesApi.update(id, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        department: values.department || undefined,
        position: values.position || undefined,
        employmentType: values.employmentType,
        status: values.status,
        salary: values.salary ? Number(values.salary) : undefined,
      }),
    onSuccess: () => {
      toast.success('Employee updated')
      void queryClient.invalidateQueries({ queryKey: ['employees', id] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const uploadDocument = useMutation({
    mutationFn: (file: File) => employeesApi.uploadDocument(id, file, uploadType),
    onSuccess: () => {
      toast.success('Document uploaded')
      void queryClient.invalidateQueries({ queryKey: ['employees', id, 'documents'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const deleteDocument = useMutation({
    mutationFn: (documentId: string) => employeesApi.deleteDocument(documentId),
    onSuccess: () => {
      toast.success('Document deleted')
      void queryClient.invalidateQueries({ queryKey: ['employees', id, 'documents'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  if (isLoading || !employee) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Employees', to: '/employees' },
          { label: employee.fullName ?? `${employee.firstName} ${employee.lastName}` },
        ]}
      />
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => void navigate('/employees')}>
        <ArrowLeftIcon /> Employees
      </Button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarImage src={employee.photo} alt="" />
            <AvatarFallback>
              {initials(employee.fullName ?? `${employee.firstName} ${employee.lastName}`)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {employee.fullName ?? `${employee.firstName} ${employee.lastName}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {employee.employeeId} · {employee.email}
            </p>
          </div>
        </div>
        <Badge className="capitalize">{employee.status.replace('_', ' ')}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!canEdit} />
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
                          <Input {...field} disabled={!canEdit} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" disabled={!canEdit} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!canEdit} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select
                          value={field.value || 'none'}
                          onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                          disabled={!canEdit}
                        >
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
                        <Select
                          value={field.value || 'none'}
                          onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                          disabled={!canEdit}
                        >
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
                        <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUSES.map((status) => (
                              <SelectItem key={status} value={status} className="capitalize">
                                {status.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {employee.salary !== undefined ? (
                  <FormField
                    control={form.control}
                    name="salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={0} disabled={!canEdit} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Salary is only visible to roles with edit access on employee records.
                  </p>
                )}
                {canEdit && (
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              {employee.certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">None on file.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {employee.certifications.map((cert, i) => {
                    const name = typeof cert.certification === 'string' ? cert.certification : cert.certification.name
                    return (
                      <li key={i} className="flex items-center justify-between">
                        <span>{name}</span>
                        {cert.expiryDate && (
                          <span className="text-xs text-muted-foreground">
                            expires {new Date(cert.expiryDate).toLocaleDateString()}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={uploadDocument.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ArrowUpTrayIcon />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadDocument.mutate(file)
                    e.target.value = ''
                  }}
                />
              </div>
              {(documents ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <ul className="space-y-1">
                  {(documents ?? []).map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center gap-2 truncate text-primary hover:underline"
                      >
                        <DocumentTextIcon className="size-4 shrink-0" />
                        <span className="truncate">{doc.fileName}</span>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => deleteDocument.mutate(doc.id)}
                        disabled={deleteDocument.isPending}
                      >
                        <TrashIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
