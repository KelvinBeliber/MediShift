import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  ChatBubbleLeftRightIcon,
  HashtagIcon,
  PaperAirplaneIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { EmptyState } from '@/components/data/EmptyState'
import { Panel } from '@/components/dashboard-primitives/Panel'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentUser, usePermission } from '@/features/auth/usePermission'
import { employeesApi } from '@/features/employees/api'
import { messagesApi } from '@/features/messages/api'
import type { Message } from '@/features/messages/types'
import { toApiError } from '@/lib/api/errors'
import { getSocket } from '@/lib/socket'
import { staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Conversation = { type: 'department'; id: string; name: string } | { type: 'direct'; id: string; name: string }

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function senderId(message: Message): string {
  return typeof message.sender === 'string' ? message.sender : message.sender.id
}

function senderLabel(message: Message): string {
  return typeof message.sender === 'string' ? message.sender : message.sender.email
}

/** Screen 20 — `/messages`. Two panes: conversations, then the active thread. */
export function MessagesPage() {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const canSend = usePermission('message:send')
  const canBrowseEmployees = usePermission('employee:view')

  const [active, setActive] = useState<Conversation | null>(null)
  const [directContacts, setDirectContacts] = useState<Map<string, string>>(new Map())
  const [draft, setDraft] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: me } = useQuery({
    queryKey: ['employees', 'me', 'for-messages'],
    queryFn: () => employeesApi.me(),
    retry: false,
  })
  const { data: employeeData } = useQuery({
    queryKey: ['employees', 'for-messages'],
    queryFn: () => employeesApi.list({ limit: 100 }),
    enabled: canBrowseEmployees && pickerOpen,
  })

  const myDepartment = me?.department

  const contactable = (employeeData?.items ?? []).filter((e) => e.user && e.user !== user?.id)

  const directQuery = useQuery({
    queryKey: ['messages', 'direct', active?.type === 'direct' ? active.id : null],
    queryFn: () => messagesApi.direct(active!.id),
    enabled: active?.type === 'direct',
  })
  const departmentQuery = useQuery({
    queryKey: ['messages', 'department', active?.type === 'department' ? active.id : null],
    queryFn: () => messagesApi.department(active!.id),
    enabled: active?.type === 'department',
  })

  const threadData = active?.type === 'direct' ? directQuery.data : departmentQuery.data
  const thread = useMemo(() => threadData?.items ?? [], [threadData])
  const threadLoading = active?.type === 'direct' ? directQuery.isPending : departmentQuery.isPending

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  // Mark anything from someone else as read once the thread is open and loaded.
  useEffect(() => {
    if (!active || threadLoading) return
    for (const message of thread) {
      if (senderId(message) === user?.id) continue
      if (message.readBy.some((r) => r.user === user?.id)) continue
      void messagesApi.markRead(message.id)
    }
  }, [active, thread, threadLoading, user?.id])

  useEffect(() => {
    const socket = getSocket()
    if (myDepartment) socket.emit('department:join', myDepartment.id)

    const onMessage = (incoming: Message) => {
      if (incoming.conversationType === 'department' && incoming.department) {
        void queryClient.invalidateQueries({ queryKey: ['messages', 'department', incoming.department] })
      } else if (incoming.conversationType === 'direct') {
        const otherId = senderId(incoming) === user?.id ? incoming.recipient : senderId(incoming)
        if (otherId && otherId !== user?.id) {
          setDirectContacts((prev) => (prev.has(otherId) ? prev : new Map(prev).set(otherId, senderLabel(incoming))))
          void queryClient.invalidateQueries({ queryKey: ['messages', 'direct', otherId] })
        }
      }
    }
    socket.on('message:new', onMessage)
    return () => {
      socket.off('message:new', onMessage)
      if (myDepartment) socket.emit('department:leave', myDepartment.id)
    }
  }, [myDepartment, queryClient, user?.id])

  const send = useMutation({
    mutationFn: (content: string) =>
      messagesApi.send(
        active?.type === 'department'
          ? { conversationType: 'department', department: active.id, content }
          : { conversationType: 'direct', recipient: active!.id, content },
      ),
    onSuccess: () => {
      setDraft('')
      if (active?.type === 'direct') void queryClient.invalidateQueries({ queryKey: ['messages', 'direct', active.id] })
      else if (active?.type === 'department')
        void queryClient.invalidateQueries({ queryKey: ['messages', 'department', active.id] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const contacts = useMemo(() => Array.from(directContacts.entries()), [directContacts])

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-5xl gap-4">
      <Panel className="flex w-72 shrink-0 flex-col p-0">
        <div className="border-b p-4">
          <h1 className="text-lg leading-[1.35] font-bold tracking-[-0.012em]">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {myDepartment && (
            <button
              type="button"
              onClick={() => setActive({ type: 'department', id: myDepartment.id, name: myDepartment.name })}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                active?.type === 'department' && active.id === myDepartment.id
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'hover:bg-secondary/60',
              )}
            >
              <HashtagIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{myDepartment.name}</span>
            </button>
          )}

          <div className="mt-4 mb-1.5 flex items-center justify-between px-2.5">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Direct</span>
            {canBrowseEmployees && (
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                New
              </button>
            )}
          </div>

          {pickerOpen && (
            <div className="mb-2 px-2">
              <Select
                onValueChange={(userId) => {
                  const emp = contactable.find((e) => e.user === userId)
                  setActive({ type: 'direct', id: userId, name: emp ? `${emp.firstName} ${emp.lastName}` : userId })
                  setPickerOpen(false)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a colleague" />
                </SelectTrigger>
                <SelectContent>
                  {contactable.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No one has claimed a login yet.</div>
                  )}
                  {contactable.map((e) => (
                    <SelectItem key={e.id} value={e.user!}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {contacts.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">
              {canBrowseEmployees ? 'Start a new conversation above.' : 'Conversations you open appear here.'}
            </p>
          ) : (
            contacts.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActive({ type: 'direct', id, name: label })}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                  active?.type === 'direct' && active.id === id
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'hover:bg-secondary/60',
                )}
              >
                <Avatar size="sm">
                  <AvatarFallback>{initials(label)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{label}</span>
              </button>
            ))
          )}

          <p className="mt-4 px-2.5 text-xs text-muted-foreground">
            Direct conversations you've opened this session — there's no server-side inbox list yet, so a reload
            clears this pane; the department channel above always comes back.
          </p>
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col p-0">
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              title="Pick a conversation"
              description="Choose your department channel or start a direct message from the left."
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-4">
              {active.type === 'department' ? (
                <HashtagIcon className="size-4 text-muted-foreground" />
              ) : (
                <UsersIcon className="size-4 text-muted-foreground" />
              )}
              <p className="font-semibold">{active.name}</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {threadLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className={cn('h-10 w-2/3', i % 2 === 0 ? '' : 'ml-auto')} />
                  ))}
                </div>
              ) : thread.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <ChatBubbleLeftRightIcon className="mr-2 size-4" /> No messages yet — say hello.
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                  {thread.map((m) => {
                    const mine = senderId(m) === user?.id
                    return (
                      <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                        <div
                          className={cn(
                            'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                            mine ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                          )}
                        >
                          {m.content}
                        </div>
                        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                          {!mine && active.type === 'department' && `${senderLabel(m)} · `}
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </motion.div>
              )}
            </div>

            {canSend ? (
              <form
                className="flex items-end gap-2 border-t p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (draft.trim()) send.mutate(draft.trim())
                }}
              >
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  rows={1}
                  className="min-h-11 flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (draft.trim()) send.mutate(draft.trim())
                    }
                  }}
                />
                <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending} aria-label="Send">
                  <PaperAirplaneIcon className="size-4" />
                </Button>
              </form>
            ) : (
              <p className="border-t p-3 text-center text-xs text-muted-foreground">
                Your role doesn't include sending messages — you can still read this conversation.
              </p>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
