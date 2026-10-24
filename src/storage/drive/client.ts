import { File, UploadType } from 'expo-file-system';

import GoogleAuth from '@modules/google-auth';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_FOLDER_NAME = 'Panna';
const FILE_FIELDS = 'id,name,size,modifiedTime,trashed,appProperties';

export type DriveFile = {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
  trashed?: boolean;
  appProperties?: { pannaId?: string };
};

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// Google's access tokens last an hour; refresh a little earlier.
const TOKEN_TTL_MS = 50 * 60 * 1000;
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * An access token for Drive. With `interactive`, Google may show its account/consent screens and
 * this resolves null if the user cancels. Without it, no UI is shown (fails if consent is needed).
 */
export async function getToken({ interactive = false } = {}): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const value = await GoogleAuth.authorizeAsync(interactive);
  if (!value) return null;
  cachedToken = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
  return value;
}

export function forgetToken() {
  cachedToken = null;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new DriveError('Google Drive is not connected.');
  return { Authorization: `Bearer ${token}` };
}

/** fetch with the Drive token; on 401 the token is refreshed once. */
async function request(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), ...(await authHeader()) },
  });
  if (response.status === 401 && retry) {
    forgetToken();
    return request(url, init, false);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new DriveError(`Google Drive error ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`, response.status);
  }
  return response;
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  body: JSON.stringify(body),
});

export async function getUserEmail(): Promise<string> {
  const response = await request('https://www.googleapis.com/oauth2/v3/userinfo');
  return ((await response.json()) as { email: string }).email;
}

/** Revokes the app's access, so the next connect shows Google's consent screen again. */
export async function revokeAccess() {
  const token = cachedToken?.value;
  forgetToken();
  if (!token) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
}

/** The app's "Panna" folder in My Drive (created if missing). */
export async function ensureFolder(knownId: string | null): Promise<string> {
  if (knownId) {
    try {
      const file = (await (await request(`${API}/files/${knownId}?fields=id,trashed`)).json()) as DriveFile;
      if (!file.trashed) return file.id;
    } catch (e) {
      if (!(e instanceof DriveError) || e.status !== 404) throw e;
    }
  }
  const q = encodeURIComponent(`name='${DRIVE_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`);
  const found = (await (await request(`${API}/files?q=${q}&fields=files(id)&spaces=drive`)).json()) as { files: DriveFile[] };
  if (found.files.length) return found.files[0].id;

  const created = await request(`${API}/files?fields=id`, {
    method: 'POST',
    ...json({ name: DRIVE_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  return ((await created.json()) as DriveFile).id;
}

/** Every (non-trashed) file in the folder. */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const files: DriveFile[] = [];
  let pageToken = '';
  do {
    const url = `${API}/files?q=${q}&fields=nextPageToken,files(${FILE_FIELDS})&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const page = (await (await request(url)).json()) as { files: DriveFile[]; nextPageToken?: string };
    files.push(...page.files);
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return files;
}

/** Resumable upload: metadata first, then the file body in one PUT. Creates a file, or replaces `fileId`'s content. */
async function resumableUpload(localFileUri: string, metadata: object, fileId?: string): Promise<DriveFile> {
  const url = fileId
    ? `${UPLOAD_API}/files/${fileId}?uploadType=resumable&fields=${FILE_FIELDS}`
    : `${UPLOAD_API}/files?uploadType=resumable&fields=${FILE_FIELDS}`;
  const session = await request(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/pdf' },
    body: JSON.stringify(metadata),
  });
  const location = session.headers.get('location');
  if (!location) throw new DriveError('Google Drive did not start the upload.');

  const result = await new File(localFileUri).upload(location, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'application/pdf' },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new DriveError(`Upload failed (${result.status})`, result.status);
  }
  return JSON.parse(result.body) as DriveFile;
}

export function uploadNewFile(
  localFileUri: string,
  { name, folderId, docId }: { name: string; folderId: string; docId: string },
) {
  return resumableUpload(localFileUri, {
    name,
    parents: [folderId],
    mimeType: 'application/pdf',
    appProperties: { pannaId: docId },
  });
}

export function replaceFileContent(fileId: string, localFileUri: string, name: string) {
  return resumableUpload(localFileUri, { name }, fileId);
}

export async function downloadFile(fileId: string, destination: File): Promise<File> {
  return File.downloadFileAsync(`${API}/files/${fileId}?alt=media`, destination, {
    headers: await authHeader(),
    idempotent: true,
  });
}

export async function renameFile(fileId: string, name: string) {
  await request(`${API}/files/${fileId}?fields=id`, { method: 'PATCH', ...json({ name }) });
}

/** Moves a file to Drive's Bin, where the user can still restore it for 30 days. */
export async function trashFile(fileId: string) {
  try {
    await request(`${API}/files/${fileId}?fields=id`, { method: 'PATCH', ...json({ trashed: true }) });
  } catch (e) {
    if (!(e instanceof DriveError) || e.status !== 404) throw e;
  }
}
