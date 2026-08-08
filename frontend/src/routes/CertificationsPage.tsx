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
import { certificationsApi } from '@/features/certifications/api'
import type { Certification } from '@/features/certifications/types'
import { toApiError } from '@/lib/api/errors'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Required'),
  code: z.string().trim().min(1, 'Required'),
  description: z.string().trim().optional(),
  issuingBody: z.string().trim().optional(),
  validityPeriodMonths: z.string().trim().optional(),
})

type FormValues = z.infer<typeof formSchema>

/** Screen 12 — `/certifications`. */
export function CertificationsPage() {
  const canManage = usePermission('certification:manage')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Certification | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['certifications'],
    queryFn: () => certificationsApi.list(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', code: '', description: '', issuingBody: '', validityPeriodMonths: '' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', code: '', description: '', issuingBody: '', validityPeriodMonths: '' })
    setDialogOpen(true)
  }

  function openEdit(cert: Certification) {
    setEditing(cert)
    form.reset({
      name: cert.name,
      code: cert.code,
      description: cert.description ?? '',
      issuingBody: cert.issuingBody ?? '',
      validityPeriodMonths: cert.validityPeriodMonths ? String(cert.validityPeriodMonths) : '',
    })
    setDialogOpen(true)
  }

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        issuingBody: values.issuingBody || undefined,
        validityPeriodMonths: values.validityPeriodMonths === '' ? undefined : Number(values.validityPeriodMonths),
      }
      return editing ? certificationsApi.update(editing.id, payload) : certificationsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Certification updated' : 'Certification created')
      void queryClient.invalidateQueries({ queryKey: ['certifications'] })
      setDialogOpen(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => certificationsApi.deactivate(id),
    onSuccess: () => {
      toast.success('Certification deactivated')
      void queryClient.invalidateQueries({ queryKey: ['certifications'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const certifications = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Certifications"
        description="ICU Certified, ACLS, BLS, and other credentials tracked against employees and shift requirements."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <PlusIcon /> New certification
            </Button>
          )
        }
      />

      {!isLoading && certifications.length === 0 && (
        <EmptyState title="No certifications yet" description="Create one to start requiring it on shifts and positions." />
      )}

      {certifications.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Issuing body</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {certifications.map((cert) => (
              <TableRow key={cert.id}>
                <TableCell className="font-medium">{cert.name}</TableCell>
                <TableCell className="font-mono text-xs">{cert.code}</TableCell>
                <TableCell>{cert.issuingBody ?? '—'}</TableCell>
                <TableCell>
                  {cert.validityPeriodMonths ? `${cert.validityPeriodMonths} months` : 'No expiry'}
                </TableCell>
                <TableCell>
                  <Badge variant={cert.isActive ? 'secondary' : 'outline'}>
                    {cert.isActive ? <CheckCircleIcon aria-hidden="true" /> : <XCircleIcon aria-hidden="true" />}
                    {cert.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(cert)}>
                        <PencilIcon />
                      </Button>
                      {cert.isActive && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={deactivate.isPending}
                          onClick={() => deactivate.mutate(cert.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit certification' : 'New certification'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ICU Certified" />
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
                      <Input {...field} placeholder="ICU-CERT" className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issuingBody"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuing body</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="American Heart Association" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validityPeriodMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validity period (months)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={0} placeholder="Leave blank if it never expires" />
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
