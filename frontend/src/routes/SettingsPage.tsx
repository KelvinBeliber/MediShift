import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Cog6ToothIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Panel } from '@/components/dashboard-primitives/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { settingsApi } from '@/features/settings/api'
import type { SystemSetting } from '@/features/settings/types'
import { toApiError } from '@/lib/api/errors'

/** Best-effort JSON parse — a raw string setting value should stay a string, not fail to save. */
function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function displayValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

const formSchema = z.object({
  key: z.string().trim().min(1, 'Required').refine((k) => !k.startsWith('counter:'), 'Reserved for internal use'),
  value: z.string().trim().min(1, 'Required'),
  description: z.string().trim().optional(),
})
type FormValues = z.infer<typeof formSchema>

/** Screen 24 — `/settings`. `system_settings:manage`-gated (super_admin only) at the router. */
export function SettingsPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SystemSetting | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { key: '', value: '', description: '' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ key: '', value: '', description: '' })
    setDialogOpen(true)
  }

  function openEdit(s: SystemSetting) {
    setEditing(s)
    form.reset({ key: s.key, value: displayValue(s.value), description: s.description ?? '' })
    setDialogOpen(true)
  }

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      settingsApi.upsert(values.key, { value: parseValue(values.value), description: values.description || undefined }),
    onSuccess: () => {
      toast.success(editing ? 'Setting updated' : 'Setting created')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      setDialogOpen(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const remove = useMutation({
    mutationFn: (key: string) => settingsApi.remove(key),
    onSuccess: () => {
      toast.success('Setting removed')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      setConfirmingDelete(null)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const settings = data ?? []

  return (
    <div>
      <PageHeader
        title="Settings"
        description="A raw key-value store for hospital-wide configuration. Super admin only."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon /> Add setting
          </Button>
        }
      />

      {isLoading ? (
        <Panel className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Panel>
      ) : settings.length === 0 ? (
        <EmptyState
          title="No settings yet"
          description="Add key-value entries like hospital.name or max-upload-mb — there's no fixed schema."
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Cog6ToothIcon /> Add the first one
            </Button>
          }
        />
      ) : (
        <Panel className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="font-mono text-sm">{s.key}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-sm text-muted-foreground">
                    {displayValue(s.value)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.description ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)} aria-label="Edit">
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={confirmingDelete === s.key ? 'text-destructive' : undefined}
                        onClick={() =>
                          confirmingDelete === s.key ? remove.mutate(s.key) : setConfirmingDelete(s.key)
                        }
                        aria-label="Delete"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit setting' : 'Add setting'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="hospital.name" disabled={Boolean(editing)} className="font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} className="font-mono" placeholder='"a string", 42, true, or {"nested":"json"}' />
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
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add setting'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
