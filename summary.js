// summary.js
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('lastSession', (data) => {
    if (!data || !data.lastSession) {
      document.getElementById('text-summary').innerHTML = '<div class="stat-value" style="color:#f44336;">セッションデータが見つかりません</div>';
      return;
    }
    const session = data.lastSession;
    renderSummary(session);
  });
});

const getDifficultyName = (d) => {
  if (d <= 11) return (12 - d) + "Q";
  else return (d - 11) + "D";
};

const truncateText = (ctx, text, maxWidth) => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
};

const drawMetricCard = (ctx, x, y, w, h, label, value, valueColor) => {
  // Soft gray background for the card
  ctx.fillStyle = '#F8FAFC'; // Slate 50
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  
  // Subtle border
  ctx.strokeStyle = '#E2E8F0'; // Slate 200
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.fillStyle = '#64748B'; // Slate 500
  ctx.font = '13px "Inter", "Helvetica Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 24);
  
  // Value
  ctx.fillStyle = valueColor || '#0F172A'; // Slate 900
  ctx.font = 'bold 24px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText(value, x + w / 2, y + 54);
};

function renderSummary(session) {
  const container = document.getElementById('text-summary');
  container.style.display = 'none'; 
  
  const startTime = session.startTime || Date.now();
  const endTime = session.endTime || Date.now();
  const durationMin = Math.max(1, Math.round((endTime - startTime) / 60000));
  
  const initGrade = getDifficultyName(session.initialDifficulty || session.currentDifficulty);
  const currentGrade = getDifficultyName(session.currentDifficulty);
  
  let totalAC = 0;
  let totalFail = 0;
  Object.values(session.solvedCount || {}).forEach(v => totalAC += v);
  Object.values(session.failedCount || {}).forEach(v => totalFail += v);

  drawCanvas(session, durationMin, totalAC, totalFail, initGrade, currentGrade);
}

function drawCanvas(session, durationMin, totalAC, totalFail, initGrade, currentGrade) {
  const canvas = document.getElementById('export-canvas');
  const ctx = canvas.getContext('2d');
  
  const width = 800;
  const history = session.history || [];
  const listStartY = 240;
  const rowHeight = 48;
  
  // If no items, keep a nice default height
  const height = Math.max(400, listStartY + (history.length * rowHeight) + 80);
  
  canvas.width = width;
  canvas.height = height;

  // Global White Background wrapper
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Top Accent Border (Blue to signify coding platform vibe)
  ctx.fillStyle = '#2563EB'; // Blue 600
  ctx.fillRect(0, 0, width, 6);

  // Title text
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 26px "Inter", "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Novisteps-ClimbMode リザルト', width / 2, 60);

  // Metric Cards
  const cardW = 150;
  const cardH = 75;
  const gap = 20;
  const startX = (width - (cardW * 4 + gap * 3)) / 2;
  
  // Neutral metrics
  drawMetricCard(ctx, startX, 100, cardW, cardH, '所要時間', `${durationMin} 分`, '#111827');
  drawMetricCard(ctx, startX + cardW + gap, 100, cardW, cardH, 'グレード推移', `${initGrade} ➔ ${currentGrade}`, '#2563EB');
  // AtCoder specific AC/WA colors (Green and Orange)
  drawMetricCard(ctx, startX + (cardW + gap) * 2, 100, cardW, cardH, '総AC数', `${totalAC}`, '#059669'); // Emerald 600
  drawMetricCard(ctx, startX + (cardW + gap) * 3, 100, cardW, cardH, '総解説AC数', `${totalFail}`, '#D97706'); // Amber 600

  // History List Header
  if (history.length > 0) {
    ctx.fillStyle = '#6B7280'; // Gray 500
    ctx.font = 'bold 14px "Inter", sans-serif';
    
    // Header labels
    ctx.textAlign = 'center';
    ctx.fillText('難易度', 110, listStartY - 10);
    ctx.textAlign = 'left';
    ctx.fillText('問題名', 180, listStartY - 10);
    ctx.textAlign = 'center';
    ctx.fillText('結果', width - 110, listStartY - 10);

    // Separator line under header
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, listStartY);
    ctx.lineTo(width - 60, listStartY);
    ctx.stroke();

    // History items
    history.forEach((record, idx) => {
      const y = listStartY + 10 + (idx * rowHeight);
      
      // Zebra striping for better readability (Light Slate for even rows)
      if (idx % 2 === 0) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(60, y, width - 120, rowHeight);
      }

      ctx.fillStyle = '#111827'; // Very dark gray for grade
      ctx.font = 'bold 15px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(record.difficultyName, 110, y + 29);

      // Title
      ctx.textAlign = 'left';
      ctx.fillStyle = '#2563EB'; // Blue link color
      ctx.font = '15px "Inter", sans-serif';
      const safeTitle = truncateText(ctx, record.title, width - 340);
      ctx.fillText(safeTitle, 180, y + 29);

      // Status Badge
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Inter", sans-serif';
      if (record.status === 'AC') {
        ctx.fillStyle = '#D1FAE5'; // Emerald 100 background
        ctx.beginPath();
        ctx.roundRect(width - 140, y + 10, 60, 28, 6);
        ctx.fill();
        ctx.fillStyle = '#059669'; // Emerald 600 text
        ctx.fillText('AC', width - 110, y + 30);
      } else {
        ctx.fillStyle = '#FEF3C7'; // Amber 100 background
        ctx.beginPath();
        ctx.roundRect(width - 152, y + 10, 84, 28, 6);
        ctx.fill();
        ctx.fillStyle = '#D97706'; // Amber 600 text
        ctx.fillText('解説AC', width - 110, y + 30);
      }
    });

    // Bottom border
    ctx.strokeStyle = '#E5E7EB';
    ctx.beginPath();
    const finalY = listStartY + 10 + (history.length * rowHeight);
    ctx.moveTo(60, finalY);
    ctx.lineTo(width - 60, finalY);
    ctx.stroke();

  } else {
    // Empty state
    ctx.fillStyle = '#9CA3AF'; // Gray 400
    ctx.font = '16px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('挑戦した記録はありません。', width / 2, listStartY + 60);
  }

  // Watermark
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '13px "Inter", sans-serif';
  ctx.textAlign = 'right';
  const dateStr = new Date(session.endTime || Date.now()).toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
  });
  ctx.fillText(`${dateStr} - Novisteps-ClimbMode`, width - 40, height - 30);

  // Setup Tweet behavior passing data out to handlers
  window.__climbModeSessionParams = {
    durationMin,
    initGrade,
    currentGrade,
    totalAC,
    totalFail
  };
}

document.getElementById('download-btn').addEventListener('click', () => {
  const canvas = document.getElementById('export-canvas');
  const link = document.createElement('a');
  link.download = `novisteps_climbmode_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.getElementById('tweet-btn').addEventListener('click', async () => {
  const canvas = document.getElementById('export-canvas');
  const params = window.__climbModeSessionParams || {};
  const tweetText = `Novisteps-ClimbMode でトレーニングしました！\n所要時間: ${params.durationMin || '?'}分\nグレード推移: ${params.initGrade || '?'} ➔ ${params.currentGrade || '?'}\n結果: ${params.totalAC || 0} AC / ${params.totalFail || 0} 解説AC\n#AtCoder #Novisteps #NovistepsClimbmode\n https://github.com/blueberry1001/Novisteps-Climbmode`;
  const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  try {
    canvas.toBlob(async (blob) => {
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        alert("📊 結果画像をクリップボードにコピーしました！\n\nX(Twitter) の投稿画面が開きますので、テキストボックスで「ペースト（Ctrl+V）」して画像を添付し、そのままシェアしてください。");
      } catch (err) {
        console.warn("Clipboard copy failed natively, may require secure context focus", err);
      }
      window.open(twUrl, '_blank');
    });
  } catch(e) {
    window.open(twUrl, '_blank');
  }
});
