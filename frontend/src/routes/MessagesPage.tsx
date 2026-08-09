import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
import { Badge } from '@/components/ui/badge'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Marker, MarkerContent } from '@/components/ui/marker'
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentUser, usePermission } from '@/features/auth/usePermission'
import { employeesApi } from '@/features/employees/api'
import { messagesApi } from '@/features/messages/api'
import type { Message as MessageType } from '@/features/messages/types'
import { toApiError } from '@/lib/api/errors'
import { getSocket } from '@/lib/socket'
import { cn } from '@/lib/utils'

type Conversation = { type: 'department'; id: string; name: string } | { type: 'direct'; id: string; name: string }

type TypingEvent = { userId: string; conversationType: 'direct' | 'department'; department?: string }

const TYPING_STOP_DELAY = 2000
const TYPING_EXPIRE_AFTER = 4000
const GROUP_GAP_MS = 5 * 60 * 1000

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function senderId(message: MessageType): string {
  return typeof message.sender === 'string' ? message.sender : message.sender.id
}

function senderLabel(message: MessageType): string {
  return typeof message.sender === 'string' ? message.sender : message.sender.email
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatLastSeen(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'Active just now'
  if (minutes < 60) return `Active ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Active ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Active yesterday'
  if (days < 7) return `Active ${days}d ago`
  return `Active ${new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

/** Small green ring-cutout dot, the universal "this person is online" signal. */
function PresenceDot({ className }: { className?: string }) {
  return <span className={cn('absolute right-0 bottom-0 size-2.5 rounded-full bg-brand-green ring-2 ring-card', className)} />
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

type ThreadItem =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'group'; key: string; mine: boolean; senderId: string; messages: MessageType[] }

/** Collapses consecutive same-sender messages within a short window, and drops in "Today" / "Aug 3" separators. */
function buildThreadItems(thread: MessageType[], myId: string | undefined): ThreadItem[] {
  const items: ThreadItem[] = []
  let lastDay: string | null = null
  let currentGroup: Extract<ThreadItem, { kind: 'group' }> | null = null

  for (const m of thread) {
    const day = new Date(m.createdAt).toDateString()
    if (day !== lastDay) {
      items.push({ kind: 'date', key: `date-${m.id}`, label: formatDateLabel(m.createdAt) })
      lastDay = day
      currentGroup = null
    }

    const sid = senderId(m)
    const last = currentGroup?.messages[currentGroup.messages.length - 1]
    const withinGap =
      currentGroup && currentGroup.senderId === sid && last
        ? new Date(m.createdAt).getTime() - new Date(last.createdAt).getTime() < GROUP_GAP_MS
        : false

    if (currentGroup && withinGap) {
      currentGroup.messages.push(m)
    } else {
      currentGroup = { kind: 'group', key: `group-${m.id}`, mine: sid === myId, senderId: sid, messages: [m] }
      items.push(currentGroup)
    }
  }
  return items
}

/** The bouncing three-dot bubble every chat app uses to say "someone's composing a reply". */
function TypingDots() {
  const reducedMotion = useReducedMotion()
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/70"
          animate={reducedMotion ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
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
  const [typingUserId, setTypingUserId] = useState<string | null>(null)
  const typingExpiryRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [lastSeenAt, setLastSeenAt] = useState<Map<string, string>>(new Map())

  const { data: me } = useQuery({
    queryKey: ['employees', 'me', 'for-messages'],
    queryFn: () => employeesApi.me(),
    retry: false,
  })
  const { data: employeeData } = useQuery({
    queryKey: ['employees', 'for-messages'],
    queryFn: () => employeesApi.list({ limit: 100 }),
    enabled: canBrowseEmployees,
  })
  const { data: inbox } = useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messagesApi.inbox(),
  })

  const myDepartment = me?.department

  const contactable = (employeeData?.items ?? []).filter((e) => e.user && e.user !== user?.id)
  const employeeNameByUser = useMemo(
    () => new Map(contactable.map((e) => [e.user!, `${e.firstName} ${e.lastName}`])),
    [contactable],
  )

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

  const threadItems = useMemo(() => buildThreadItems(thread, user?.id), [thread, user?.id])
  const lastGroup = useMemo(
    () => [...threadItems].reverse().find((i): i is Extract<ThreadItem, { kind: 'group' }> => i.kind === 'group'),
    [threadItems],
  )
  const seenByOther =
    active?.type === 'direct' && lastGroup?.mine
      ? (lastGroup.messages[lastGroup.messages.length - 1]?.readBy.some((r) => r.user === active.id) ?? false)
      : false

  // Mark anything from someone else as read once the thread is open and loaded.
  useEffect(() => {
    if (!active || threadLoading) return
    const unread = thread.filter(
      (message) => senderId(message) !== user?.id && !message.readBy.some((r) => r.user === user?.id),
    )
    if (unread.length === 0) return
    void Promise.all(unread.map((message) => messagesApi.markRead(message.id))).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] })
    })
  }, [active, thread, threadLoading, user?.id, queryClient])

  // Typing state resets whenever the open conversation changes.
  useEffect(() => {
    setTypingUserId(null)
  }, [active?.type, active?.id])

  // Presence is independent of which conversation is open, so it gets its own
  // subscription — `presence:sync` is a targeted reply to `presence:request`
  // (connecting after other tabs already established online users), while
  // `presence:online`/`presence:offline` are broadcast as connections change.
  useEffect(() => {
    const socket = getSocket()

    const onSync = (payload: { onlineUserIds: string[]; lastSeenAt: Record<string, string> }) => {
      setOnlineUserIds(new Set(payload.onlineUserIds))
      setLastSeenAt(new Map(Object.entries(payload.lastSeenAt)))
    }
    const onOnline = (payload: { userId: string }) => {
      setOnlineUserIds((prev) => new Set(prev).add(payload.userId))
      setLastSeenAt((prev) => {
        if (!prev.has(payload.userId)) return prev
        const next = new Map(prev)
        next.delete(payload.userId)
        return next
      })
    }
    const onOffline = (payload: { userId: string; lastSeenAt: string }) => {
      setOnlineUserIds((prev) => {
        if (!prev.has(payload.userId)) return prev
        const next = new Set(prev)
        next.delete(payload.userId)
        return next
      })
      setLastSeenAt((prev) => new Map(prev).set(payload.userId, payload.lastSeenAt))
    }

    socket.on('presence:sync', onSync)
    socket.on('presence:online', onOnline)
    socket.on('presence:offline', onOffline)
    socket.emit('presence:request')

    return () => {
      socket.off('presence:sync', onSync)
      socket.off('presence:online', onOnline)
      socket.off('presence:offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (myDepartment) socket.emit('department:join', myDepartment.id)

    const onMessage = (incoming: MessageType) => {
      if (incoming.conversationType === 'department' && incoming.department) {
        void queryClient.invalidateQueries({ queryKey: ['messages', 'department', incoming.department] })
      } else if (incoming.conversationType === 'direct') {
        const otherId = senderId(incoming) === user?.id ? incoming.recipient : senderId(incoming)
        if (otherId && otherId !== user?.id) {
          setDirectContacts((prev) => (prev.has(otherId) ? prev : new Map(prev).set(otherId, senderLabel(incoming))))
          void queryClient.invalidateQueries({ queryKey: ['messages', 'direct', otherId] })
          void queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] })
        }
      }
    }

    const clearTypingSoon = (uid: string) => {
      const existing = typingExpiryRef.current.get(uid)
      if (existing) clearTimeout(existing)
      typingExpiryRef.current.set(
        uid,
        setTimeout(() => {
          setTypingUserId((cur) => (cur === uid ? null : cur))
          typingExpiryRef.current.delete(uid)
        }, TYPING_EXPIRE_AFTER),
      )
    }

    const isForActiveThread = (payload: TypingEvent) =>
      !!active &&
      ((active.type === 'direct' && payload.conversationType === 'direct' && payload.userId === active.id) ||
        (active.type === 'department' && payload.conversationType === 'department' && payload.department === active.id))

    const onTypingStart = (payload: TypingEvent) => {
      if (payload.userId === user?.id || !isForActiveThread(payload)) return
      setTypingUserId(payload.userId)
      clearTypingSoon(payload.userId)
    }
    const onTypingStop = (payload: TypingEvent) => {
      setTypingUserId((cur) => (cur === payload.userId ? null : cur))
      const existing = typingExpiryRef.current.get(payload.userId)
      if (existing) {
        clearTimeout(existing)
        typingExpiryRef.current.delete(payload.userId)
      }
    }

    socket.on('message:new', onMessage)
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)
    return () => {
      socket.off('message:new', onMessage)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
      if (myDepartment) socket.emit('department:leave', myDepartment.id)
    }
  }, [myDepartment, queryClient, user?.id, active])

  const typingPayload = active
    ? active.type === 'department'
      ? ({ conversationType: 'department' as const, department: active.id })
      : ({ conversationType: 'direct' as const, recipient: active.id })
    : null

  function notifyTyping() {
    if (!typingPayload || !canSend) return
    const socket = getSocket()
    socket.emit('typing:start', typingPayload)
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    typingStopRef.current = setTimeout(() => socket.emit('typing:stop', typingPayload), TYPING_STOP_DELAY)
  }

  function stopTypingNow() {
    if (!typingPayload) return
    if (typingStopRef.current) {
      clearTimeout(typingStopRef.current)
      typingStopRef.current = null
    }
    getSocket().emit('typing:stop', typingPayload)
  }

  const send = useMutation({
    mutationFn: (content: string) =>
      messagesApi.send(
        active?.type === 'department'
          ? { conversationType: 'department', department: active.id, content }
          : { conversationType: 'direct', recipient: active!.id, content },
      ),
    onSuccess: () => {
      setDraft('')
      stopTypingNow()
      if (active?.type === 'direct') {
        void queryClient.invalidateQueries({ queryKey: ['messages', 'direct', active.id] })
        void queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] })
      } else if (active?.type === 'department') {
        void queryClient.invalidateQueries({ queryKey: ['messages', 'department', active.id] })
      }
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const contacts = useMemo(() => {
    const fromInbox = (inbox ?? []).map((item) => ({
      id: item.user.id,
      label: employeeNameByUser.get(item.user.id) ?? item.user.email,
      unreadCount: item.unreadCount,
    }))
    const inboxIds = new Set(fromInbox.map((c) => c.id))
    const pending = Array.from(directContacts.entries())
      .filter(([id]) => !inboxIds.has(id))
      .map(([id, label]) => ({ id, label: employeeNameByUser.get(id) ?? label, unreadCount: 0 }))
    return [...fromInbox, ...pending]
  }, [inbox, directContacts, employeeNameByUser])

  const typingLabel =
    typingUserId &&
    (active?.type === 'department' ? (employeeNameByUser.get(typingUserId) ?? 'Someone') : (active?.name ?? 'They'))

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
                      <span className="flex items-center gap-1.5">
                        {onlineUserIds.has(e.user!) && <span className="size-1.5 rounded-full bg-brand-green" />}
                        {e.firstName} {e.lastName}
                      </span>
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
            contacts.map(({ id, label, unreadCount }) => (
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
                <span className="relative inline-flex shrink-0">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(label)}</AvatarFallback>
                  </Avatar>
                  {onlineUserIds.has(id) && <PresenceDot />}
                </span>
                <span className="flex-1 truncate">{label}</span>
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      key="badge"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <Badge variant="default" className="h-5 min-w-5 justify-center px-1 text-[0.6875rem]">
                        {unreadCount}
                      </Badge>
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            ))
          )}
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
                <span className="relative inline-flex shrink-0">
                  <UsersIcon className="size-4 text-muted-foreground" />
                  {onlineUserIds.has(active.id) && <PresenceDot className="-right-0.5 -bottom-0.5 size-2 ring-1" />}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-semibold">{active.name}</p>
                {active.type === 'direct' && !typingLabel && (
                  <p className="text-xs text-muted-foreground">
                    {onlineUserIds.has(active.id)
                      ? 'Active now'
                      : lastSeenAt.has(active.id)
                        ? formatLastSeen(lastSeenAt.get(active.id)!)
                        : null}
                  </p>
                )}
              </div>
              <AnimatePresence>
                {typingLabel && (
                  <motion.span
                    key="typing"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-muted-foreground italic"
                  >
                    {active.type === 'department' ? `${typingLabel} is typing…` : 'typing…'}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {threadLoading ? (
                <div className="flex-1 space-y-3 p-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className={cn('h-10 w-2/3', i % 2 === 0 ? '' : 'ml-auto')} />
                  ))}
                </div>
              ) : thread.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  <ChatBubbleLeftRightIcon className="mr-2 size-4" /> No messages yet — say hello.
                </div>
              ) : (
                <MessageScrollerProvider autoScroll>
                  <MessageScroller className="flex-1">
                    <MessageScrollerViewport>
                      <MessageScrollerContent className="p-4">
                        {threadItems.map((item) =>
                          item.kind === 'date' ? (
                            <Marker key={item.key} variant="separator">
                              <MarkerContent>{item.label}</MarkerContent>
                            </Marker>
                          ) : (
                            <MessageScrollerItem key={item.key} messageId={item.key} scrollAnchor={item.mine}>
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                              >
                                <Message align={item.mine ? 'end' : 'start'}>
                                  {!item.mine && active.type === 'department' && (
                                    <MessageAvatar>
                                      <Avatar size="sm">
                                        <AvatarFallback>
                                          {initials(senderLabel(item.messages[0]!))}
                                        </AvatarFallback>
                                      </Avatar>
                                    </MessageAvatar>
                                  )}
                                  <MessageContent>
                                    {!item.mine && active.type === 'department' && (
                                      <MessageHeader>{senderLabel(item.messages[0]!)}</MessageHeader>
                                    )}
                                    {item.messages.map((m) => (
                                      <Bubble key={m.id} variant={item.mine ? 'default' : 'secondary'} align={item.mine ? 'end' : 'start'}>
                                        <BubbleContent>{m.content}</BubbleContent>
                                      </Bubble>
                                    ))}
                                    <MessageFooter>
                                      {formatTime(item.messages[item.messages.length - 1]!.createdAt)}
                                      {item.mine && active.type === 'direct' && item.key === lastGroup?.key && seenByOther && (
                                        <span className="ml-1">· Seen</span>
                                      )}
                                    </MessageFooter>
                                  </MessageContent>
                                </Message>
                              </motion.div>
                            </MessageScrollerItem>
                          ),
                        )}

                        <AnimatePresence>
                          {typingLabel && (
                            <motion.div
                              key="typing-bubble"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                            >
                              <Message align="start">
                                <MessageContent>
                                  <Bubble variant="secondary" align="start">
                                    <BubbleContent className="py-2">
                                      <TypingDots />
                                    </BubbleContent>
                                  </Bubble>
                                </MessageContent>
                              </Message>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton />
                  </MessageScroller>
                </MessageScrollerProvider>
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
                  onChange={(e) => {
                    setDraft(e.target.value)
                    if (e.target.value.trim()) notifyTyping()
                    else stopTypingNow()
                  }}
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
