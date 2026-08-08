import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  KeyIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, PANEL_PADDING } from '@/components/dashboard-primitives/Panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PasswordField } from '@/components/auth/PasswordField'
import { authApi } from '@/features/auth/api'
import { useCurrentUser } from '@/features/auth/usePermission'
import { roleLabel } from '@/features/auth/user'
import { employeesApi } from '@/features/employees/api'
import { DOCUMENT_TYPES } from '@/features/employees/types'
import { toApiError } from '@/lib/api/errors'

const profileSchema = z.object({
  phone: z.string().trim().optional(),
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  country: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactRelationship: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
})
type ProfileValues = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Required'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })
type PasswordValues = z.infer<typeof passwordSchema>

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function ChangePasswordPanel() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const change = useMutation({
    mutationFn: (values: PasswordValues) => authApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success('Password changed — other sessions have been signed out')
      form.reset()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  return (
    <Panel className={PANEL_PADDING}>
      <div className="mb-4 flex items-center gap-2">
        <KeyIcon className="size-4.5 text-brand-teal-deep" />
        <h2 className="text-lg leading-[1.35] font-bold tracking-[-0.012em]">Password</h2>
      </div>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => change.mutate(values))}>
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current password</FormLabel>
                <FormControl>
                  <PasswordField {...field} autoComplete="current-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <PasswordField {...field} autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <PasswordField {...field} autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </Form>
    </Panel>
  )
}

/** Screen 23 — `/profile`. */
export function ProfilePage() {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const [uploadType, setUploadType] = useState<string>(DOCUMENT_TYPES[0])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ['employees', 'me'],
    queryFn: () => employeesApi.me(),
    retry: false,
  })

  const notLinked = error && toApiError(error).status === 400

  const { data: documents } = useQuery({
    queryKey: ['employees', employee?.id, 'documents'],
    queryFn: () => employeesApi.documents(employee!.id),
    enabled: Boolean(employee?.id),
  })

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: employee
      ? {
          phone: employee.phone ?? '',
          street: employee.address?.street ?? '',
          city: employee.address?.city ?? '',
          state: employee.address?.state ?? '',
          zip: employee.address?.zip ?? '',
          country: employee.address?.country ?? '',
          contactName: employee.emergencyContact?.name ?? '',
          contactRelationship: employee.emergencyContact?.relationship ?? '',
          contactPhone: employee.emergencyContact?.phone ?? '',
        }
      : undefined,
  })

  const save = useMutation({
    mutationFn: (values: ProfileValues) =>
      employeesApi.updateMe({
        phone: values.phone || undefined,
        address: {
          street: values.street || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          zip: values.zip || undefined,
          country: values.country || undefined,
        },
        emergencyContact: {
          name: values.contactName || undefined,
          relationship: values.contactRelationship || undefined,
          phone: values.contactPhone || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Profile updated')
      void queryClient.invalidateQueries({ queryKey: ['employees', 'me'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const uploadDocument = useMutation({
    mutationFn: (file: File) => employeesApi.uploadDocument(employee!.id, file, uploadType),
    onSuccess: () => {
      toast.success('Document uploaded')
      void queryClient.invalidateQueries({ queryKey: ['employees', employee?.id, 'documents'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
  const deleteDocument = useMutation({
    mutationFn: (documentId: string) => employeesApi.deleteDocument(documentId),
    onSuccess: () => {
      toast.success('Document removed')
      void queryClient.invalidateQueries({ queryKey: ['employees', employee?.id, 'documents'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile" description="Your contact details, password and documents." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : notLinked ? (
        <div className="space-y-6">
          <Panel className={PANEL_PADDING}>
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>{user ? initials(user.email) : '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{user?.email}</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {user && roleLabel(user)}
                </Badge>
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
              <UserIcon className="mt-0.5 size-4 shrink-0" />
              This account isn't linked to an employee record, so there's no contact profile to edit — that's
              normal for admin accounts. You can still change your password below.
            </p>
          </Panel>
          <ChangePasswordPanel />
        </div>
      ) : (
        employee && (
          <div className="space-y-6">
            <Panel className={PANEL_PADDING}>
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage src={employee.photo} alt="" />
                  <AvatarFallback>{initials(`${employee.firstName} ${employee.lastName}`)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {employee.employeeId}
                    {employee.department && ` · ${employee.department.name}`}
                    {employee.position && ` · ${employee.position.title}`}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel className={PANEL_PADDING}>
              <h2 className="mb-4 text-lg leading-[1.35] font-bold tracking-[-0.012em]">Contact details</h2>
              <Form {...form}>
                <form className="space-y-5" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <p className="mb-2 text-sm font-medium">Address</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="street" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormControl><Input {...field} placeholder="Street" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="city" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input {...field} placeholder="City" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="state" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input {...field} placeholder="State" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="zip" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input {...field} placeholder="ZIP" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="country" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input {...field} placeholder="Country" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">Emergency contact</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="contactName" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormControl><Input {...field} placeholder="Name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="contactRelationship" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input {...field} placeholder="Relationship" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="contactPhone" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input {...field} placeholder="Phone" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </form>
              </Form>
            </Panel>

            <Panel className={PANEL_PADDING}>
              <h2 className="mb-4 text-lg leading-[1.35] font-bold tracking-[-0.012em]">Documents</h2>
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
                <p className="mt-3 text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
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
            </Panel>

            <ChangePasswordPanel />
          </div>
        )
      )}
    </div>
  )
}
