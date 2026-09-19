export function mediaExtension(data,contentType) {
  const signatures = {
    'image/png': () => data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : null,
    'image/jpeg': () => data[0]===255 && data[1]===216 && data[2]===255 ? 'jpg' : null,
    'image/gif': () => ['GIF87a','GIF89a'].includes(data.subarray(0,6).toString()) ? 'gif' : null,
    'image/webp': () => data.subarray(0,4).toString()==='RIFF' && data.subarray(8,12).toString()==='WEBP' ? 'webp' : null,
    'video/mp4': () => data.subarray(4,8).toString()==='ftyp' ? 'mp4' : null,
    'video/webm': () => data.subarray(0,4).equals(Buffer.from([26,69,223,163])) ? 'webm' : null,
  };
  return data.length>=12 ? signatures[contentType]?.() || null : null;
}
