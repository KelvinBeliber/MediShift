import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { z } from 'zod'
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  ExclamationTriangleIcon,
  MegaphoneIcon,
  SignalIcon,
} from '@heroicons/react/24/solid'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Panel, PANEL_PADDING } from '@/components/dashboard-primitives/Panel'
import { DepartmentBadge } from '@/components/data/DepartmentBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { usePermission } from '@/features/auth/usePermission'
import { announcementsApi } from '@/features/announcements/api'
import { ANNOUNCEMENT_PRIORITIES, ANNOUNCEMENT_SCOPES, type Announcement } from '@/features/announcements/types'
import { departmentsApi } from '@/features/departments/api'
import { toApiError } from '@/lib/api/errors'
import { staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

// `important` deliberately isn't `success` (green) here — that colour now
// means "this went well" everywhere else in the app, and an announcement
// being important isn't a good outcome, it's an attention level. `warning`
// is the correct rung between a routine notice and a true emergency.
const PRIORITY_META = {
  normal: { icon: MegaphoneIcon, chip: 'text-muted-foreground', badge: 'outline' as const, label: 'Notice' },
  important: { icon: SignalIcon, chip: 'text-amber-600', badge: 'warning' as const, label: 'Important' },
  emergency: {
    icon: ExclamationTriangleIcon,
    chip: 'text-destructive',
    badge: 'destructive' as const,
    label: 'Emergency',
  },
}

const formSchema = z
  .object({
    title: z.string().trim().min(1, 'Required'),
    body: z.string().trim().min(1, 'Required'),
    scope: z.enum(ANNOUNCEMENT_SCOPES),
    department: z.string().optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES),
    expiresAt: z.string().optional(),
  })
  .refine((d) => d.scope !== 'department' || Boolean(d.department), {
    message: 'Required for a department announcement',
    path: ['department'],
  })
type FormValues = z.infer<typeof formSchema>

/** Screen 19 — `/announcements`. */
export function AnnouncementsPage() {
  const canManage = usePermission('announcement:manage')
  const queryClient = useQueryClient()
  const [priority, setPriority] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', { priority }],
    queryFn: () => announcementsApi.list({ priority: priority || undefined, limit: 50 }),
  })
  const { data: departments } = useQuery({
    queryKey: ['departments', 'for-announcements'],
    queryFn: () => departmentsApi.list(),
    enabled: canManage,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', body: '', scope: 'hospital', department: '', priority: 'normal', expiresAt: '' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ title: '', body: '', scope: 'hospital', department: '', priority: 'normal', expiresAt: '' })
    setDialogOpen(true)
  }

  function openEdit(a: Announcement) {
    setEditing(a)
    form.reset({
      title: a.title,
      body: a.body,
      scope: a.scope,
      department: a.department?.id ?? '',
      priority: a.priority,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : '',
    })
    setDialogOpen(true)
  }

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        body: values.body,
        priority: values.priority,
        expiresAt: values.expiresAt || undefined,
      }
      return editing
        ? announcementsApi.update(editing.id, payload)
        : announcementsApi.create({ ...payload, scope: values.scope, department: values.department || undefined })
    },
    onSuccess: () => {
      toast.success(editing ? 'Announcement updated' : 'Announcement published')
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setDialogOpen(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => announcementsApi.deactivate(id),
    onSuccess: () => {
      toast.success('Announcement removed')
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setConfirmingDelete(null)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const announcements = data?.items ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Announcements"
        description="Hospital-wide and department news, most recent first."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <PlusIcon /> New announcement
            </Button>
          )
        }
      />

      <div className="mb-5">
        <Select value={priority || 'all'} onValueChange={(v) => setPriority(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {ANNOUNCEMENT_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState title="No announcements" description="Nothing posted for this filter yet." />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          {announcements.map((a) => {
            const meta = PRIORITY_META[a.priority]
            const Icon = meta.icon
            return (
              <Panel
                key={a.id}
                elevation={a.priority === 'emergency' ? 'focal' : 'resting'}
                className={PANEL_PADDING}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center">
                    <Icon className={cn('size-6', meta.chip)} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{a.title}</h3>
                      <Badge variant={meta.badge} className="text-xs">
                        {meta.label}
                      </Badge>
                      {a.scope === 'hospital' ? (
                        <Badge variant="outline" className="text-xs">
                          Hospital-wide
                        </Badge>
                      ) : (
                        <DepartmentBadge
                          id={a.department?.id}
                          name={a.department?.name ?? 'Department'}
                          className="text-xs"
                        />
                      )}
                    </div>
                    <p className="mt-1.5 text-sm whitespace-pre-line text-foreground/90">{a.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {a.publishedAt && new Date(a.publishedAt).toLocaleString()}
                      {typeof a.author !== 'string' && a.author?.email && ` · ${a.author.email}`}
                      {a.expiresAt && ` · Expires ${new Date(a.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} aria-label="Edit">
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          confirmingDelete === a.id ? deactivate.mutate(a.id) : setConfirmingDelete(a.id)
                        }
                        aria-label="Delete"
                        className={confirmingDelete === a.id ? 'text-destructive' : undefined}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            )
          })}
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit announcement' : 'New announcement'}</DialogTitle>
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scope</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(editing)}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hospital">Hospital-wide</SelectItem>
                          <SelectItem value="department">Department</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ANNOUNCEMENT_PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {PRIORITY_META[p].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {form.watch('scope') === 'department' && (
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(editing)}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(departments?.items ?? []).map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expires (optional)</FormLabel>
                    <FormControl>
                      <DatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Publish'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
