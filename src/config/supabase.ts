import { auth } from './firebase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseStorageEnabled = Boolean(supabaseUrl && supabasePublishableKey);

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

async function authenticatedHeaders(contentType?: string) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Entre novamente para acessar este arquivo.');
  if (!supabaseStorageEnabled) throw new Error('O armazenamento de arquivos ainda não foi configurado.');
  const token = await user.getIdToken();
  return {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${token}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

export async function uploadPrivateFile(bucket: 'weekly-content' | 'attendance' | 'avatars', path: string, blob: Blob, contentType: string) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: await authenticatedHeaders(contentType),
    body: blob,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Não foi possível enviar o arquivo (${response.status}). ${message.slice(0, 160)}`);
  }
  return `supabase://${bucket}/${path}`;
}

export async function resolvePrivateFileUrl(resource: string, expiresIn = 3600) {
  if (!resource.startsWith('supabase://')) return resource;
  const match = resource.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error('Endereço de arquivo inválido.');
  const [, bucket, path] = match;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: await authenticatedHeaders('application/json'),
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error(`Não foi possível abrir o arquivo (${response.status}).`);
  const data = await response.json() as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl;
  if (!signed) throw new Error('O armazenamento não retornou um endereço temporário.');
  if (/^https?:\/\//.test(signed)) return signed;
  return `${supabaseUrl}/storage/v1${signed.startsWith('/') ? signed : `/${signed}`}`;
}
