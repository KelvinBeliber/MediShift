import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { PencilIcon, PlusIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, TrashIcon, XCircleIcon } from '@heroicons/react/16/solid'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { positionsApi } from '@/features/positions/api'
import type { Position } from '@/features/positions/types'
import { certificationsApi } from '@/features/certifications/api'
import { toApiError } from '@/lib/api/errors'

const formSchema = z.object({
  title: z.string().trim().min(1, 'Required'),
  description: z.string().trim().optional(),
  salaryMin: z.string().trim().optional(),
  salaryMax: z.string().trim().optional(),
  defaultWorkingHoursPerWeek: z.string().trim().optional(),
  requiredSkills: z.string().trim().optional(),
  requiredCertifications: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof formSchema>

/** Screen 11 — `/positions`. */
export function PositionsPage() {
  const canManage = usePermission('position:manage')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Position | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['positions'], queryFn: () => positionsApi.list() })
  const { data: certData } = useQuery({
    queryKey: ['certifications'],
    queryFn: () => certificationsApi.list(),
  })
  const certifications = certData?.items ?? []

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      salaryMin: '',
      salaryMax: '',
      defaultWorkingHoursPerWeek: '',
      requiredSkills: '',
      requiredCertifications: [],
    },
  })

  function openCreate() {
    setEditing(null)
    form.reset({
      title: '',
      description: '',
      salaryMin: '',
      salaryMax: '',
      defaultWorkingHoursPerWeek: '',
      requiredSkills: '',
      requiredCertifications: [],
    })
    setDialogOpen(true)
  }

  function openEdit(position: Position) {
    setEditing(position)
    form.reset({
      title: position.title,
      description: position.description ?? '',
      salaryMin: position.salaryRange?.min !== undefined ? String(position.salaryRange.min) : '',
      salaryMax: position.salaryRange?.max !== undefined ? String(position.salaryRange.max) : '',
      defaultWorkingHoursPerWeek:
        position.defaultWorkingHoursPerWeek !== undefined ? String(position.defaultWorkingHoursPerWeek) : '',
      requiredSkills: position.requiredSkills.join(', '),
      requiredCertifications: position.requiredCertifications.map((c) => (typeof c === 'string' ? c : c.id)),
    })
    setDialogOpen(true)
  }

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        description: values.description || undefined,
        salaryRange:
          values.salaryMin !== '' && values.salaryMax !== ''
            ? { min: Number(values.salaryMin), max: Number(values.salaryMax) }
            : undefined,
        defaultWorkingHoursPerWeek:
          values.defaultWorkingHoursPerWeek === '' ? undefined : Number(values.defaultWorkingHoursPerWeek),
        requiredSkills: values.requiredSkills
          ? values.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        requiredCertifications: values.requiredCertifications ?? [],
      }
      return editing ? positionsApi.update(editing.id, payload) : positionsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Position updated' : 'Position created')
      void queryClient.invalidateQueries({ queryKey: ['positions'] })
      setDialogOpen(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => positionsApi.deactivate(id),
    onSuccess: () => {
      toast.success('Position deactivated')
      void queryClient.invalidateQueries({ queryKey: ['positions'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const positions = data?.items ?? []
  const selectedCerts = form.watch('requiredCertifications') ?? []

  return (
    <div>
      <PageHeader
        title="Positions"
        description="Job titles, pay bands, and the certifications/skills they require."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <PlusIcon /> New position
            </Button>
          )
        }
      />

      {!isLoading && positions.length === 0 && (
        <EmptyState title="No positions yet" description="Create one to assign to employees." />
      )}

      {positions.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Salary range</TableHead>
              <TableHead>Hours/week</TableHead>
              <TableHead>Skills</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-medium">{position.title}</TableCell>
                <TableCell>
                  {position.salaryRange
                    ? `$${position.salaryRange.min.toLocaleString()} – $${position.salaryRange.max.toLocaleString()}`
                    : '—'}
                </TableCell>
                <TableCell>{position.defaultWorkingHoursPerWeek}</TableCell>
                <TableCell className="max-w-48 truncate">{position.requiredSkills.join(', ') || '—'}</TableCell>
                <TableCell>
                  <Badge variant={position.isActive ? 'secondary' : 'outline'}>
                    {position.isActive ? (
                      <CheckCircleIcon aria-hidden="true" />
                    ) : (
                      <XCircleIcon aria-hidden="true" />
                    )}
                    {position.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(position)}>
                        <PencilIcon />
                      </Button>
                      {position.isActive && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={deactivate.isPending}
                          onClick={() => deactivate.mutate(position.id)}
                        >
                          <TrashIcon />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit position' : 'New position'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Registered Nurse" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="salaryMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min salary</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salaryMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max salary</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="defaultWorkingHoursPerWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default hours/week</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={0} placeholder="40" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requiredSkills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Required skills</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="IV therapy, Patient triage" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Comma-separated.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Required certifications</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {certifications.map((cert) => {
                    const active = selectedCerts.includes(cert.id)
                    return (
                      <button
                        key={cert.id}
                        type="button"
                        onClick={() =>
                          form.setValue(
                            'requiredCertifications',
                            active
                              ? selectedCerts.filter((id) => id !== cert.id)
                              : [...selectedCerts, cert.id],
                          )
                        }
                      >
                        <Badge variant={active ? 'default' : 'outline'} className="cursor-pointer">
                          {cert.name}
                        </Badge>
                      </button>
                    )
                  })}
                  {certifications.length === 0 && (
                    <p className="text-xs text-muted-foreground">No certifications configured yet.</p>
                  )}
                </div>
              </FormItem>
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
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
