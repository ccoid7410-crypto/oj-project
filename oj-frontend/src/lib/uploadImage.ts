/** 이미지 파일 하나를 올리고 접근 URL을 돌려준다. 편집기(공용)가 이 함수를 받아서 쓴다. */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('oj_token');
  const res = await fetch('/api/uploads/image', {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');

  const data = await res.json();
  return data.url as string;
}
