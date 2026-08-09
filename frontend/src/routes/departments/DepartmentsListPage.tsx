import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { PlusIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/16/solid'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { DepartmentBadge } from '@/components/data/DepartmentBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { usePermission } from '@/features/auth/usePermission'
import { departmentsApi } from '@/features/departments/api'
import { toApiError, applyFieldErrors } from '@/lib/api/errors'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Required'),
  code: z.string().trim().min(1, 'Required'),
  description: z.string().trim().optional(),
})

type FormValues = z.infer<typeof formSchema>

/** Screen 9 — `/departments`. */
export function DepartmentsListPage() {
  const navigate = useNavigate()
  const canManage = usePermission('department:manage')
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', code: '', description: '' },
  })

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      departmentsApi.create({
        name: values.name,
        code: values.code,
        description: values.description || undefined,
      }),
    onSuccess: (dept) => {
      toast.success(`Department "${dept.name}" created`)
      void queryClient.invalidateQueries({ queryKey: ['departments'] })
      setCreateOpen(false)
      form.reset()
    },
    onError: (error) => {
      if (applyFieldErrors(error, form.setError)) return
      toast.error(toApiError(error).message)
    },
  })

  const departments = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Wards and units, their managers, and staffing requirements."
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon /> New department
            </Button>
          )
        }
      />

      {!isLoading && departments.length === 0 && (
        <EmptyState title="No departments yet" description="Create one to start assigning employees and schedules." />
      )}

      {departments.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow key={dept.id} className="cursor-pointer" onClick={() => void navigate(`/departments/${dept.id}`)}>
                <TableCell className="font-medium">
                  {/* Doubles as the legend for this department's colour —
                      the same badge appears wherever this department is
                      referenced elsewhere in the app (employees, schedules,
                      announcements). */}
                  <DepartmentBadge id={dept.id} name={dept.name} />
                </TableCell>
                <TableCell className="font-mono text-xs">{dept.code}</TableCell>
                <TableCell>
                  {dept.manager ? `${dept.manager.firstName} ${dept.manager.lastName}` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={dept.isActive ? 'success' : 'outline'}>
                    {dept.isActive ? <CheckCircleIcon aria-hidden="true" /> : <XCircleIcon aria-hidden="true" />}
                    {dept.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New department</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Emergency Department" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ED" className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
