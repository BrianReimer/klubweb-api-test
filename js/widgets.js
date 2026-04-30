document.getElementById('btn-run-widget').addEventListener('click', () => {
  const code  = document.getElementById('widget-code').value.trim();
  const frame = document.getElementById('widget-frame');
  const srcdoc = `<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8">
<style>body{font-family:'Space Grotesk',system-ui,sans-serif;padding:1.5rem;background:#fff;color:#000;}*{box-sizing:border-box;}</style>
</head><body>
${code}
</body></html>`;
  frame.srcdoc = srcdoc;
});
