'use client'

import { useState, type FormEvent } from 'react'

import Avatar from '@/components/Avatar'
import FriendPhotos from '@/components/FriendPhotos'
import SharedProfileView from '@/components/SharedProfileView'
import { useI18n } from '@/lib/i18n'
import type { MessageKey } from '@/lib/messages'
import { approvePhotoAccess, endPhotoAccess, requestPhotoAccess, type PhotoAccess } from '@/lib/photo-access'
import {
  acceptFriendRequest,
  endFriendship,
  fetchSharedProfile,
  normalizeHandle,
  sendFriendRequest,
  type FriendRequestResult,
  type Friendship,
  type ShareSettings,
  type SharedProfile,
} from '@/lib/social'

type FriendsViewProps = {
  friendships: Friendship[]
  photoAccess: PhotoAccess[]
  share: ShareSettings | null
  hasLoadError: boolean
  onRefresh: () => Promise<void>
  onOpenShare: () => void
}

const REQUEST_MESSAGES: Record<FriendRequestResult, MessageKey> = {
  sent: 'friends.sent',
  accepted: 'friends.nowFriends',
  already: 'friends.already',
  self: 'friends.self',
  not_found: 'friends.notFound',
}

export default function FriendsView({ friendships, photoAccess, share, hasLoadError, onRefresh, onOpenShare }: FriendsViewProps) {
  const { t } = useI18n()
  const [handle, setHandle] = useState('')
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [viewing, setViewing] = useState<SharedProfile | null>(null)

  const requests = friendships.filter((item) => item.status === 'pending')
  const friends = friendships.filter((item) => item.status === 'accepted')
  const photoRequests = photoAccess.filter((item) => item.status === 'pending' && item.isIncoming)
  const photoViewers = photoAccess.filter((item) => item.status === 'approved' && item.isIncoming)

  async function run(action: () => Promise<void>) {
    setIsBusy(true)
    try {
      await action()
      await onRefresh()
    } catch {
      setMessageKey('friends.error')
    } finally {
      setIsBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!handle) return
    await run(async () => {
      setMessageKey(REQUEST_MESSAGES[await sendFriendRequest(handle)])
      setHandle('')
    })
  }

  async function openFriend(friendHandle: string) {
    setMessageKey(null)
    try {
      setViewing(await fetchSharedProfile(friendHandle))
    } catch {
      setMessageKey('friends.error')
    }
  }

  async function askForPhotos(friendHandle: string) {
    await run(async () => {
      const result = await requestPhotoAccess(friendHandle)
      if (result === 'not_friends' || result === 'not_found') setMessageKey('friends.error')
    })
  }

  function revokePhotos(viewer: PhotoAccess) {
    if (window.confirm(t('friends.photoRevokeConfirm', { name: viewer.profile.name }))) void run(() => endPhotoAccess(viewer.id))
  }

  function remove(friend: Friendship) {
    if (window.confirm(t('friends.removeConfirm', { name: friend.profile.name }))) void run(() => endFriendship(friend.id))
  }

  if (viewing) {
    return (
      <section className="friends-view">
        <button type="button" className="friends-back" onClick={() => setViewing(null)}>{t('friends.back')}</button>
        <SharedProfileView shared={viewing} />
        {viewing.isFriend && (
          <FriendPhotos
            handle={viewing.handle}
            name={viewing.profile.name}
            access={photoAccess.find((item) => !item.isIncoming && item.handle === viewing.handle)}
            isBusy={isBusy}
            onAsk={() => void askForPhotos(viewing.handle)}
            onCancel={(accessId) => void run(() => endPhotoAccess(accessId))}
          />
        )}
      </section>
    )
  }

  return (
    <section className="friends-view reveal" aria-labelledby="friends-heading">
      <div className="overline"><span className="overline-line" /> {t('friends.kicker')}</div>
      <h1 id="friends-heading" className="friends-title">{t('friends.title')}</h1>
      <p className="friends-intro">{t('friends.intro')}</p>

      {hasLoadError && <p className="friends-note friends-note-warning" role="alert">{t('friends.loadError')}</p>}

      {share ? (
        <p className="friends-note">{t('friends.you', { handle: share.handle })}</p>
      ) : (
        <div className="friends-note">
          <span>{t('friends.needHandle')}</span>
          <button type="button" className="friends-setup" onClick={onOpenShare}>{t('friends.setup')}</button>
        </div>
      )}

      {share && (
        <form className="friends-add" onSubmit={submit}>
          <input value={handle} onChange={(event) => setHandle(normalizeHandle(event.target.value))} placeholder={t('friends.addPlaceholder')} aria-label={t('friends.addAria')} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          <button type="submit" disabled={isBusy || !handle}>{t('friends.add')}</button>
        </form>
      )}
      {messageKey && <p className="friends-message" role="status">{t(messageKey)}</p>}

      {(requests.length > 0 || photoRequests.length > 0) && (
        <div className="panel friends-panel">
          <h3>{t('friends.requests')}</h3>
          <ul className="friends-list">
            {requests.map((request) => (
              <li key={request.id}>
                <Avatar profile={request.profile} photoUrl={null} />
                <span className="friends-name">{request.isIncoming ? t('friends.incoming', { name: request.profile.name }) : t('friends.outgoing', { name: request.profile.name })}</span>
                {request.isIncoming && <button type="button" className="friends-primary" disabled={isBusy} onClick={() => void run(() => acceptFriendRequest(request.id))}>{t('friends.accept')}</button>}
                <button type="button" className="friends-quiet" disabled={isBusy} onClick={() => void run(() => endFriendship(request.id))}>{request.isIncoming ? t('friends.decline') : t('friends.cancel')}</button>
              </li>
            ))}
            {photoRequests.map((request) => (
              <li key={request.id}>
                <Avatar profile={request.profile} photoUrl={null} />
                <span className="friends-name">{t('friends.photoIncoming', { name: request.profile.name })}</span>
                <button type="button" className="friends-primary" disabled={isBusy} onClick={() => void run(() => approvePhotoAccess(request.id))}>{t('friends.photoAllow')}</button>
                <button type="button" className="friends-quiet" disabled={isBusy} onClick={() => void run(() => endPhotoAccess(request.id))}>{t('friends.decline')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel friends-panel">
        <h3>{t('friends.list')}</h3>
        {friends.length === 0 ? (
          <p className="wishlist-empty">{t('friends.empty')}</p>
        ) : (
          <ul className="friends-list">
            {friends.map((friend) => (
              <li key={friend.id}>
                <button type="button" className="friends-open" onClick={() => void openFriend(friend.handle)}>
                  <Avatar profile={friend.profile} photoUrl={null} />
                  <span className="friends-name">{friend.profile.name}</span>
                  <small>{friend.countryCount === null ? '' : t('count.countries', { n: friend.countryCount })}</small>
                </button>
                <button type="button" className="friends-quiet" disabled={isBusy} onClick={() => remove(friend)}>{t('friends.remove')}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {photoViewers.length > 0 && (
        <div className="panel friends-panel">
          <h3>{t('friends.photoViewers')}</h3>
          <ul className="friends-list">
            {photoViewers.map((viewer) => (
              <li key={viewer.id}>
                <Avatar profile={viewer.profile} photoUrl={null} />
                <span className="friends-name">{viewer.profile.name}</span>
                <button type="button" className="friends-quiet" disabled={isBusy} onClick={() => revokePhotos(viewer)}>{t('friends.photoRevoke')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
