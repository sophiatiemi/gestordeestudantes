(() => {
  const preview = document.getElementById('preview');
  const permissionOverlay = document.getElementById('permission-overlay');
  const permissionText = document.getElementById('permission-text');
  const startButton = document.getElementById('start-camera');

  const shutterButton = document.getElementById('shutter');
  const flashOverlay = document.getElementById('flash-overlay');
  const thumbnail = document.getElementById('thumbnail');
  const flashToggle = document.getElementById('flash-toggle');
  const flipButton = document.getElementById('flip-camera');

  const reviewScreen = document.getElementById('review-screen');
  const reviewPhoto = document.getElementById('review-photo');
  const closeReviewButton = document.getElementById('close-review');

  const captureCanvas = document.getElementById('capture-canvas');

  const cameraScreen = document.getElementById('camera-screen');
  const styleHandle = document.getElementById('style-handle');
  const stylePanel = document.getElementById('style-panel');
  const closeStylePanelButton = document.getElementById('close-style-panel');
  const styleStrip = document.getElementById('style-strip');
  const styleTabButtons = document.querySelectorAll('.style-tab');
  const modeTabButtons = document.querySelectorAll('.mode-tabs span');

  const joPanel = document.getElementById('jo-panel');
  const joCollapse = document.getElementById('jo-collapse');
  const joTest = document.getElementById('jo-test');
  const joInputForm = document.getElementById('jo-input-bar');
  const joInput = document.getElementById('jo-input');
  const joMessages = document.getElementById('jo-messages');

  const JO_LOGO_SVG = `<svg viewBox="0 0 140 140">
      <path class="jo-j" d="M46 46 L46 88 Q46 108 28 108 Q12 108 8 92" fill="none" stroke="#2b3fe0" stroke-width="15" stroke-linecap="round" />
      <path class="jo-hat" d="M84 44 L104 26 L124 44 L108 40 L100 52 Z" fill="#2b3fe0" />
      <circle class="jo-o" cx="104" cy="76" r="30" fill="#2b3fe0" />
      <ellipse class="jo-eye" cx="104" cy="76" rx="10" ry="8" fill="#f7f7f7" />
    </svg>`;

  const STYLES = [
    { id: 'padrao', label: 'Padrão', filter: 'none', gradient: 'linear-gradient(135deg,#3a3a3a,#161616)' },
    { id: 'festa', label: 'Festa', filter: 'contrast(1.3) saturate(1.25) brightness(0.82)', image: 'styles/festa.jpg' },
    { id: 'revista', label: 'Revista', filter: 'grayscale(1) contrast(1.05) brightness(1.08)', image: 'styles/revista.jpg' },
    { id: 'show', label: 'Show', filter: 'contrast(1.2) saturate(1.3) brightness(0.9) sepia(0.15)', gradient: 'linear-gradient(135deg,#ffcf5c,#e8532e)' },
    { id: 'cidade', label: 'Cidade', filter: 'contrast(0.95) saturate(0.85) brightness(1.1) sepia(0.15)', image: 'styles/cidade.jpg' },
    { id: 'comida', label: 'Comida', filter: 'saturate(1.4) contrast(1.15) brightness(0.92) sepia(0.1)', image: 'styles/comida.jpg' },
  ];

  let currentStream = null;
  let currentTrack = null;
  let imageCapture = null;
  let torchSupported = false;
  let currentFacing = 'environment';
  let flashOn = false;

  let activeStyleId = 'padrao';
  let recentStyleIds = [];
  let currentPanelTab = 'prontos';

  let currentPhotoUrl = null;

  function findStyle(id) {
    return STYLES.find((s) => s.id === id);
  }

  async function openStream(facing) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 7680 },
        height: { ideal: 4320 },
      },
      audio: false,
    });

    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
    }

    currentStream = stream;
    currentFacing = facing;
    preview.srcObject = stream;
    preview.classList.toggle('mirrored', facing === 'user');

    currentTrack = stream.getVideoTracks()[0];

    imageCapture = null;
    if (currentTrack && 'ImageCapture' in window) {
      try {
        imageCapture = new ImageCapture(currentTrack);
      } catch (e) {
        imageCapture = null;
      }
    }

    torchSupported = false;
    try {
      const caps = currentTrack.getCapabilities ? currentTrack.getCapabilities() : {};
      torchSupported = !!caps.torch;
    } catch (e) {
      torchSupported = false;
    }
  }

  async function startCamera() {
    try {
      await openStream(currentFacing);
      permissionOverlay.classList.add('hidden');
    } catch (err) {
      permissionText.textContent =
        'Não foi possível acessar a câmera. Verifique se você permitiu o acesso e se está usando HTTPS, depois tente novamente.';
      startButton.textContent = 'Tentar novamente';
    }
  }

  async function flipCamera() {
    if (!currentStream) return;
    const nextFacing = currentFacing === 'environment' ? 'user' : 'environment';
    try {
      await openStream(nextFacing);
    } catch (err) {
      // Câmera solicitada indisponível neste aparelho — mantém a atual.
    }
  }

  function toggleFlash() {
    flashOn = !flashOn;
    flashToggle.setAttribute('aria-pressed', String(flashOn));
  }

  async function takePhoto() {
    const useStyle = activeStyleId !== 'padrao';
    const useMirror = currentFacing === 'user';
    let torchApplied = false;

    if (flashOn) {
      triggerFlash();
      if (torchSupported && currentTrack) {
        try {
          await currentTrack.applyConstraints({ advanced: [{ torch: true }] });
          torchApplied = true;
        } catch (e) {
          torchApplied = false;
        }
      }
    }

    try {
      if (!useStyle && !useMirror && imageCapture) {
        try {
          let photoSettings;
          try {
            const caps = await imageCapture.getPhotoCapabilities();
            if (caps.imageWidth && caps.imageHeight) {
              photoSettings = { imageWidth: caps.imageWidth.max, imageHeight: caps.imageHeight.max };
            }
          } catch (e) {
            // getPhotoCapabilities() não suportado — segue sem imageWidth/imageHeight explícitos.
          }
          const blob = await imageCapture.takePhoto(photoSettings);
          showPhoto(blob);
          return;
        } catch (err) {
          // Sensor não suportou takePhoto() nesta situação — cai para a captura via canvas abaixo.
        }
      }

      captureFromCanvas(useMirror, useStyle);
    } finally {
      if (torchApplied) {
        try {
          await currentTrack.applyConstraints({ advanced: [{ torch: false }] });
        } catch (e) {
          // ignora
        }
      }
    }
  }

  function captureFromCanvas(mirror, useStyle) {
    const width = preview.videoWidth;
    const height = preview.videoHeight;
    if (!width || !height) return;

    captureCanvas.width = width;
    captureCanvas.height = height;
    const ctx = captureCanvas.getContext('2d');

    ctx.save();
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = useStyle ? findStyle(activeStyleId).filter : 'none';
    ctx.drawImage(preview, 0, 0, width, height);
    ctx.restore();

    captureCanvas.toBlob((blob) => {
      if (blob) showPhoto(blob);
    }, 'image/jpeg', 1);
  }

  function showPhoto(blob) {
    discardPhoto();
    currentPhotoUrl = URL.createObjectURL(blob);
    reviewPhoto.src = currentPhotoUrl;
    thumbnail.style.backgroundImage = `url(${currentPhotoUrl})`;
    thumbnail.disabled = false;
    openReview();
  }

  function triggerFlash() {
    flashOverlay.classList.add('flashing');
    setTimeout(() => flashOverlay.classList.remove('flashing'), 150);
    setTimeout(() => flashOverlay.classList.remove('flashing'), 400);
  }

  function openReview() {
    reviewScreen.classList.remove('hidden');
  }

  function closeReview() {
    reviewScreen.classList.add('hidden');
    discardPhoto();
  }

  function discardPhoto() {
    if (currentPhotoUrl) {
      URL.revokeObjectURL(currentPhotoUrl);
      currentPhotoUrl = null;
    }
    reviewPhoto.removeAttribute('src');
    thumbnail.style.backgroundImage = '';
    thumbnail.disabled = true;
  }

  // ---------- Painel de estilos ----------

  function renderStrip(tab) {
    styleStrip.innerHTML = '';

    if (tab === 'favoritos') {
      styleStrip.innerHTML = '<p class="empty-state">Nenhum estilo favoritado ainda.</p>';
      return;
    }

    let list;
    if (tab === 'recentes') {
      if (recentStyleIds.length === 0) {
        styleStrip.innerHTML = '<p class="empty-state">Nenhum estilo usado recentemente.</p>';
        return;
      }
      list = recentStyleIds.map(findStyle).filter(Boolean);
    } else {
      list = STYLES;
    }

    list.forEach((style) => {
      const tile = document.createElement('button');
      tile.className = 'style-tile' + (style.id === activeStyleId ? ' active' : '');
      const swatchStyle = style.image
        ? `background-image:url(${style.image}); filter:${style.filter}`
        : `background:${style.gradient}; filter:${style.filter}`;
      tile.innerHTML =
        `<span class="swatch" style="${swatchStyle}"></span>` +
        `<span>${style.label}</span>`;
      tile.addEventListener('click', () => selectStyle(style.id));
      styleStrip.appendChild(tile);
    });
  }

  function selectStyle(id) {
    activeStyleId = id;
    preview.style.filter = findStyle(id).filter;
    recentStyleIds = [id, ...recentStyleIds.filter((existing) => existing !== id)].slice(0, 5);
    renderStrip(currentPanelTab);
  }

  function openPanel() {
    cameraScreen.classList.add('panel-open');
    setActiveMode('estilos');
    renderStrip(currentPanelTab);
  }

  function closePanel() {
    cameraScreen.classList.remove('panel-open');
  }

  function togglePanel() {
    if (cameraScreen.classList.contains('panel-open')) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function setActiveMode(mode) {
    modeTabButtons.forEach((span) => {
      span.classList.toggle('active', span.dataset.mode === mode);
    });
  }

  // ---------- Tela da Jô ----------

  function openJoPanel() {
    cameraScreen.classList.add('jo-open');
  }

  function closeJoPanel() {
    cameraScreen.classList.remove('jo-open');
  }

  function toggleJoPanel() {
    if (cameraScreen.classList.contains('jo-open')) {
      closeJoPanel();
    } else {
      openJoPanel();
    }
  }

  function sendJoMessage(text) {
    joPanel.classList.add('has-sent');

    const userMsg = document.createElement('div');
    userMsg.className = 'jo-msg-user';
    const thumbHtml = currentPhotoUrl ? `<img class="jo-thumb" src="${currentPhotoUrl}" alt="Foto anexada" />` : '';
    userMsg.innerHTML = `${thumbHtml}<p class="jo-bubble"></p>`;
    userMsg.querySelector('.jo-bubble').textContent = text;
    joMessages.appendChild(userMsg);

    const status = document.createElement('div');
    status.className = 'jo-msg-status';
    status.innerHTML = `<span class="jo-logo loading">${JO_LOGO_SVG}</span><span class="jo-status-text">Capturando...</span>`;
    joMessages.appendChild(status);

    joMessages.scrollIntoView({ block: 'end' });

    setTimeout(() => {
      status.querySelector('.jo-logo').classList.remove('loading');
      status.querySelector('.jo-status-text').textContent = 'Pronto! Toque em "Testar" para ver na câmera.';
    }, 2300);
  }

  joInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = joInput.value.trim();
    if (!text) return;
    sendJoMessage(text);
    joInput.value = '';
  });

  joCollapse.addEventListener('click', closeJoPanel);
  joTest.addEventListener('click', closeJoPanel);

  // Arraste na alça "Jô": arrastar pra cima abre, pra baixo fecha, tocar alterna.
  let dragStartY = null;
  let dragMoved = false;

  styleHandle.addEventListener('pointerdown', (e) => {
    dragStartY = e.clientY;
    dragMoved = false;
    try {
      styleHandle.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignora
    }
  });

  styleHandle.addEventListener('pointermove', (e) => {
    if (dragStartY === null) return;
    const delta = dragStartY - e.clientY;
    if (Math.abs(delta) > 10) dragMoved = true;
    if (delta > 30) {
      openJoPanel();
      dragStartY = null;
    } else if (delta < -30) {
      closeJoPanel();
      dragStartY = null;
    }
  });

  styleHandle.addEventListener('pointerup', () => {
    if (dragStartY !== null && !dragMoved) {
      toggleJoPanel();
    }
    dragStartY = null;
    dragMoved = false;
  });

  styleHandle.addEventListener('pointercancel', () => {
    dragStartY = null;
    dragMoved = false;
  });

  closeStylePanelButton.addEventListener('click', closePanel);

  styleTabButtons.forEach((tabButton) => {
    tabButton.addEventListener('click', () => {
      styleTabButtons.forEach((btn) => btn.classList.remove('active'));
      tabButton.classList.add('active');
      currentPanelTab = tabButton.dataset.tab;
      renderStrip(currentPanelTab);
    });
  });

  modeTabButtons.forEach((span) => {
    span.addEventListener('click', () => {
      const mode = span.dataset.mode;
      setActiveMode(mode);
      if (mode === 'estilos') {
        openPanel();
      } else {
        closePanel();
      }
    });
  });

  // ---------- Eventos gerais ----------

  startButton.addEventListener('click', startCamera);
  shutterButton.addEventListener('click', takePhoto);
  flashToggle.addEventListener('click', toggleFlash);
  flipButton.addEventListener('click', flipCamera);
  thumbnail.addEventListener('click', () => {
    if (currentPhotoUrl) openReview();
  });
  closeReviewButton.addEventListener('click', closeReview);

  window.addEventListener('beforeunload', () => {
    discardPhoto();
    if (currentStream) currentStream.getTracks().forEach((track) => track.stop());
  });
})();
