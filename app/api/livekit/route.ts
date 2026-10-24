import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, TrackSource, VideoGrant } from 'livekit-server-sdk';
import { ChannelType } from '@prisma/client';
import { currentProfile } from '@/lib/current-profile';
import { getChannelAccess, getConversationAccess } from '@/lib/auth/access';

// Token yalnızca odaya bağlanmak için kullanılır; bağlı kaldıkça LiveKit sunucusu onu kendisi yeniler.
// Kısa ömür, kullanılmamış (ör. atılmadan önce alınmış) bir token'ın işe yaradığı süreyi sınırlar.
const TOKEN_TTL = '10m';

const ALL_SOURCES = [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];
const AUDIO_CHANNEL_SOURCES = [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

const noStore = { 'Cache-Control': 'no-store' };

// Odayı ve izin verilen yayın kaynaklarını veritabanındaki kayıttan çıkarır; erişim yoksa null.
async function resolveRoom(profileId: string, chatId: string): Promise<{ room: string; sources: TrackSource[] } | null> {
  const [channelAccess, conversationAccess] = await Promise.all([
    getChannelAccess(profileId, chatId),
    getConversationAccess(profileId, chatId),
  ]);

  if (channelAccess) {
    const { channel } = channelAccess;
    if (channel.type === ChannelType.AUDIO) return { room: channel.id, sources: AUDIO_CHANNEL_SOURCES };
    if (channel.type === ChannelType.VIDEO) return { room: channel.id, sources: ALL_SOURCES };
    return null;
  }
  if (conversationAccess) {
    return { room: conversationAccess.conversation.id, sources: ALL_SOURCES };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const profile = await currentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }

  const chatId = req.nextUrl.searchParams.get('room');
  if (!chatId) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400, headers: noStore });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500, headers: noStore });
  }

  const target = await resolveRoom(profile.id, chatId);
  if (!target) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore });
  }

  // Kimlik ve görünen ad istemciden değil profilden gelir: profil kimliği eşsiz olduğundan
  // aynı ada sahip iki kullanıcı birbirini odadan düşürmez.
  const at = new AccessToken(apiKey, apiSecret, { identity: profile.id, name: profile.name, ttl: TOKEN_TTL });

  const grant: VideoGrant = {
    room: target.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: target.sources,
    // Açık olsa katılımcı odadaki adını değiştirip başkası gibi görünebilirdi.
    canUpdateOwnMetadata: false,
  };
  at.addGrant(grant);

  return NextResponse.json({ token: await at.toJwt() }, { headers: noStore });
}
