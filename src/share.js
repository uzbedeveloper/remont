// Share to Telegram (or whatever the phone offers). Phones get the share sheet; computers open Telegram's share page.
export async function shareText(text) {
  try {
    if (navigator.share) return await navigator.share({ text });
  } catch (e) { if (e.name === 'AbortError') return; }
  window.open(`https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(text)}`, '_blank');
}

const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// One picture for the family chat: the room now on top, finished below, the total underneath.
export async function familyPicture({ before, after, nowLabel, afterLabel, caption, sub }) {
  const [a, b] = await Promise.all([load(before), load(after)]);
  const W = 1080, h = Math.round(W * (b.naturalHeight / b.naturalWidth)), foot = 190;
  const c = document.createElement('canvas');
  c.width = W; c.height = h * 2 + foot;
  const g = c.getContext('2d');
  g.fillStyle = '#16181d'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(a, 0, 0, W, h);
  g.drawImage(b, 0, h, W, h);
  const tag = (txt, y, bg) => {
    g.font = '700 40px system-ui, sans-serif';
    const w = g.measureText(txt).width + 44;
    g.fillStyle = bg; g.beginPath(); g.roundRect(28, y + 28, w, 66, 33); g.fill();
    g.fillStyle = '#fff'; g.fillText(txt, 50, y + 75);
  };
  tag(nowLabel, 0, 'rgba(0,0,0,.6)');
  tag(afterLabel, h, '#e8572a');
  g.fillStyle = '#fff'; g.font = '800 54px system-ui, sans-serif'; g.fillText(caption, 40, h * 2 + 88);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '500 34px system-ui, sans-serif'; g.fillText(sub, 40, h * 2 + 146);
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.88));
}

export async function sharePicture(blob, text) {
  const file = new File([blob], 'remont.jpg', { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text });
  } catch (e) { if (e.name === 'AbortError') return; }
  // No file sharing (most computers): save the picture and open Telegram with the text.
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'remont.jpg'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  window.open(`https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(text)}`, '_blank');
}
