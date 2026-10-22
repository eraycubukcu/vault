# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Vault" — a Discord-style chat app (servers, text/audio/video channels, direct messages) built on Next.js 15 + React 19 RC. UI strings are mostly Turkish (`<html lang="tr">`).

## Commands

```bash
npm install            # .npmrc sets legacy-peer-deps=true (needed for React 19 RC peer deps)
npm run dev            # next dev
npm run dev2           # next dev --experimental-https (needed to test PWA / push / media on devices)
npm run build
npm run lint           # next lint (many rules disabled in .eslintrc.json)
npx prisma generate    # after editing prisma/schema.prisma
npx prisma db push     # MongoDB has no migrations; push schema changes
```

There is no test suite.

Required env vars: `DATABASE_URL` (MongoDB), Clerk keys, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`, `NEXT_PUBLIC_SITE_URL` (Socket.IO client connects here), UploadThing token, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (generate with `node generate-vapid.js`).

## Architecture

**Two routers on purpose.** Regular CRUD lives in App Router handlers under `app/api/*`. Anything that must broadcast over Socket.IO lives in the Pages Router under `pages/api/socket/*`, because only Pages API handlers get access to the underlying Node HTTP server (`res.socket.server.io`, typed as `NextApiResponseServerIo` in `types.ts`). `pages/api/socket/io.ts` lazily attaches the Socket.IO server on first request; the client fetches it before connecting. Socket.IO itself listens on `/api/socket/ws` (`lib/socket/path.ts`), a path with no route: Next closes WebSocket upgrades whose path matches a route (F-32). This requires a long-running Node process — it will not work on serverless deployments.

**Auth/profile.** Clerk (`middleware.ts`) protects everything except `/home`, `/sign-in`, `/sign-up`, `/api/uploadthing`, `/`. Clerk users map to a `Profile` row via `userID`. Use `lib/current-profile.ts` (`currentProfile()`) in App Router code and `lib/current-profile-pages.ts` (`currentProfilePages(req)`) in Pages API handlers. `lib/inital-profile.ts` (sic) creates the Profile on first visit (called from `app/(setup)/page.tsx`).

**Data model** (`prisma/schema.prisma`, MongoDB, all relations cascade): `Profile` → owns `Server`s; `Member` joins Profile↔Server with `MemberRole` (ADMIN/MODERATOR/GUEST); `Channel` (TEXT/AUDIO/VIDEO) → `Message`; `Conversation` (two Members, unique pair) → `DirectMessage`. Messages are soft-deleted (`deleted: true`, `fileUrl: null`, placeholder content). Every server gets a protected `"general"` channel that cannot be renamed or deleted. `lib/conversation.ts#getOrCreateConversation` checks both member orderings.

**Authorization is encoded in Prisma `where` clauses**, not separate checks — e.g. channel mutations do `server.update({ where: { id, members: { some: { profileId, role: { in: [ADMIN, MODERATOR] } } } } })`; owner-only actions filter on `server.profileId`. Follow this pattern for new routes. Message edit = owner only; delete = owner/ADMIN/MODERATOR.

**Realtime chat flow.** A chat view (`components/chat/chat-messages.tsx`) is generic over channels and conversations via props (`apiUrl`, `socketUrl`, `socketQuery`, `paramKey: "channelId" | "conversationId"`). Key conventions must match between server emit and client listen:
- React Query key: `chat:${chatId}`
- new message event: `chat:${chatId}:messages`
- update/delete event: `chat:${chatId}:messages:update`

History is fetched with cursor pagination (batches of 10, `nextCursor`) by `hooks/use-chat-query.ts` from `app/api/messages` or `app/api/direct-messages`; writes go through `pages/api/socket/...` via axios, which persist then `io.emit`; `hooks/use-chat-socket.ts` patches the React Query cache on events.

**Media.** `components/media-room.tsx` fetches a LiveKit token from `app/api/livekit` (room = channel or conversation id) and renders a customized `VideoConference2` (auto-pins screen shares). AUDIO/VIDEO channels and conversations with `?video=true` render MediaRoom instead of chat.

**Modals.** All modals are mounted once by `components/ui/providers/modal-provider.tsx` and driven by a zustand store (`hooks/use-model.store.ts`, `useModal().onOpen(type, data)`). To add a modal: add its name to `ModalType`, any payload to `ModalData`, and mount it in ModalProvider.

**Uploads.** UploadThing routes in `app/api/uploadthing/core.ts` (`serverImage`, `messageFile`); `next.config.ts` whitelists `utfs.io`/`uploadthing.com` images.

**Misc.** UI primitives are shadcn/ui (`components/ui`, alias `@/*` → repo root). `app/actions.ts` holds web-push server actions; the subscription is kept in memory only. Dynamic route `params`/`searchParams` are Promises (Next 15) and must be awaited.

UML diagrams of the above (PlantUML) are in `UMLs/`.
