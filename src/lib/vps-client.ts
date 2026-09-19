import { supabase } from '@/integrations/supabase/client';

// Switch only after the synchronized production cutover, never per-screen.
export const vpsEnabled = import.meta.env['VITE_DATA_BACKEND'] === 'vps';
const api = 'https://streamcore-api.legacynerxux.online';

export async function vpsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) headers.set('Authorization',`Bearer ${data.session.access_token}`);
  const response = await fetch(`${api}${path}`,{...init,headers});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'VPS request failed');
  return result as T;
}

export const vpsPosts = {
  list: (channel: string, before?: string) => vpsRequest<{rows:Array<{id:string;data:Record<string,unknown>;created_at:string}>;hasMore:boolean;cursor:string|null}>(`/v1/posts?${new URLSearchParams({channel,...(before?{before}:{})})}`),
  create: (input: unknown) => vpsRequest('/v1/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),
  mutate: (id: string, input: unknown) => vpsRequest(`/v1/posts/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),
  remove: (id: string) => vpsRequest(`/v1/posts/${encodeURIComponent(id)}`,{method:'DELETE'}),
  upload: (file: File) => vpsRequest<{url:string}>('/v1/media',{method:'POST',headers:{'Content-Type':file.type},body:file}),
  subscribe: (onPost: (payload: unknown) => void, onReset: () => void) => {
    const source = new EventSource(`${api}/v1/post-events`);
    source.addEventListener('post',event=>onPost(JSON.parse((event as MessageEvent).data)));
    source.addEventListener('reset',onReset);
    return ()=>source.close();
  },
};
