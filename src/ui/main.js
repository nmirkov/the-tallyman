// Placeholder screen (TT-001). Replaced by the real renderer in TT-003.
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#352879'; // C64 border blue
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#6c5eb5'; // C64 light blue
ctx.fillRect(16, 16, canvas.width - 32, canvas.height - 32);
ctx.fillStyle = '#352879';
ctx.font = 'bold 16px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('THE TALLYMAN — LOADING…', canvas.width / 2, canvas.height / 2);
