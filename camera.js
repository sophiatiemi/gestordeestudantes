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
  const reviewVideo = document.getElementById('review-video');
  const closeReviewButton = document.getElementById('close-review');
  const reviewGalleryButton = document.getElementById('review-gallery');
  const reviewSoundButton = document.getElementById('review-sound');
  const reviewDeleteButton = document.getElementById('review-delete');

  const galleryScreen = document.getElementById('gallery-screen');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryEmpty = document.getElementById('gallery-empty');
  const galleryCount = document.getElementById('gallery-count');
  const galleryBack = document.getElementById('gallery-back');

  const recTime = document.getElementById('rec-time');

  const captureCanvas = document.getElementById('capture-canvas');

  const cameraScreen = document.getElementById('camera-screen');
  const joOpenButton = document.getElementById('jo-open-btn');
  const stylePanel = document.getElementById('style-panel');
  const closeStylePanelButton = document.getElementById('close-style-panel');
  const styleStrip = document.getElementById('style-strip');
  const styleTabButtons = document.querySelectorAll('.style-tab');
  const modeTabButtons = document.querySelectorAll('.mode-tabs span');
  const zoomButtons = document.querySelectorAll('.zoom-bar button');
  const optionsToggle = document.getElementById('options-toggle');
  const optionItems = document.querySelectorAll('.option-item');
  const focusBox = document.getElementById('focus-box');

  const joPanel = document.getElementById('jo-panel');
  const joCollapse = document.getElementById('jo-collapse');
  const joTest = document.getElementById('jo-test');
  const joInputForm = document.getElementById('jo-input-bar');
  const joInput = document.getElementById('jo-input');
  const joSendButton = document.getElementById('jo-send');
  const joMessages = document.getElementById('jo-messages');
  const joAttachButton = document.getElementById('jo-attach');
  const joAttachSheet = document.getElementById('jo-attach-sheet');
  const joAttachRow = document.getElementById('jo-attach-row');
  const joFile = document.getElementById('jo-file');
  const joAttachment = document.getElementById('jo-attachment');
  const joAttachmentImg = document.getElementById('jo-attachment-img');
  const joAttachmentRemove = document.getElementById('jo-attachment-remove');

  const JO_LOGO_SVG = `<img class="jo-logo-video" src="media/jo-loading-dark.png" alt="" />`;

  const STYLES = [
    { id: 'padrao', label: 'Padrão', filter: 'none', gradient: 'linear-gradient(135deg,#3a3a3a,#161616)' },
    { id: 'festa', label: 'Festa', filter: 'contrast(1.3) saturate(1.25) brightness(0.82)', image: 'styles/festa.jpg' },
    { id: 'revista', label: 'Revista', filter: 'grayscale(1) contrast(1.05) brightness(1.08)', image: 'styles/revista.jpg' },
    { id: 'cidade', label: 'Cidade', filter: 'contrast(0.95) saturate(0.85) brightness(1.1) sepia(0.15)', image: 'styles/cidade.jpg' },
    { id: 'comida', label: 'Comida', filter: 'saturate(1.4) contrast(1.15) brightness(0.92) sepia(0.1)', image: 'styles/comida.jpg' },
  ];

  let currentStream = null;
  let currentTrack = null;
  let imageCapture = null;
  let torchSupported = false;
  let currentFacing = 'environment';
  let flashOn = false;

  let zoomLevel = 1;
  let zoomIsHardware = false;

  let activeStyleId = 'padrao';
  let recentStyleIds = [];
  let currentPanelTab = 'prontos';

  // Galeria da sessão: só em memória, mais recente primeiro.
  const gallery = [];
  let viewerItem = null;
  let viewerFrom = 'camera';

  let captureMode = 'foto';
  let recorder = null;
  let recordChunks = [];
  let recordStart = 0;
  let recordTimer = null;
  let recordAudioStream = null;
  let recordPoster = null;

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

    await applyZoom(zoomLevel);
  }

  function updatePreviewTransform() {
    const mirror = currentFacing === 'user' ? -1 : 1;
    const cssScale = zoomIsHardware ? 1 : zoomLevel;
    preview.style.transform = `scaleX(${mirror}) scale(${cssScale})`;
  }

  async function applyZoom(value) {
    zoomLevel = value;
    zoomIsHardware = false;

    if (currentTrack) {
      try {
        const caps = currentTrack.getCapabilities ? currentTrack.getCapabilities() : {};
        if (caps.zoom && value >= caps.zoom.min && value <= caps.zoom.max) {
          await currentTrack.applyConstraints({ advanced: [{ zoom: value }] });
          zoomIsHardware = true;
        }
      } catch (e) {
        zoomIsHardware = false;
      }
    }

    zoomButtons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.zoom) === value);
    });
    updatePreviewTransform();
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
    const useCssZoom = !zoomIsHardware && zoomLevel !== 1;
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
      if (!useStyle && !useMirror && !useCssZoom && imageCapture) {
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

      captureFromCanvas(useMirror, useStyle, useCssZoom);
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

  function captureFromCanvas(mirror, useStyle, useCssZoom) {
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
    if (useCssZoom) {
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-width / 2, -height / 2);
    }
    ctx.filter = useStyle ? findStyle(activeStyleId).filter : 'none';
    ctx.drawImage(preview, 0, 0, width, height);
    ctx.restore();

    captureCanvas.toBlob((blob) => {
      if (blob) showPhoto(blob);
    }, 'image/jpeg', 1);
  }

  function showPhoto(blob) {
    const item = { type: 'photo', url: URL.createObjectURL(blob) };
    addToGallery(item);
    openViewer(item, 'camera');
  }

  function triggerFlash() {
    flashOverlay.classList.add('flashing');
    setTimeout(() => flashOverlay.classList.remove('flashing'), 150);
    setTimeout(() => flashOverlay.classList.remove('flashing'), 400);
  }

  // ---------- Galeria ----------

  function addToGallery(item) {
    gallery.unshift(item);
    updateThumbnail();
  }

  function itemPreviewUrl(item) {
    return item.type === 'photo' ? item.url : item.posterUrl;
  }

  function updateThumbnail() {
    const latest = gallery[0];
    thumbnail.style.backgroundImage = latest && itemPreviewUrl(latest) ? `url(${itemPreviewUrl(latest)})` : '';
    thumbnail.classList.remove('pop');
    void thumbnail.offsetWidth;
    if (latest) thumbnail.classList.add('pop');
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderGallery() {
    galleryGrid.innerHTML = '';
    galleryEmpty.classList.toggle('hidden', gallery.length > 0);
    const photos = gallery.filter((i) => i.type === 'photo').length;
    const videos = gallery.length - photos;
    const parts = [];
    if (photos) parts.push(`${photos} ${photos === 1 ? 'foto' : 'fotos'}`);
    if (videos) parts.push(`${videos} ${videos === 1 ? 'vídeo' : 'vídeos'}`);
    galleryCount.textContent = parts.join(' · ');

    gallery.forEach((item) => {
      const tile = document.createElement('button');
      tile.className = 'gallery-tile';
      tile.setAttribute('aria-label', item.type === 'photo' ? 'Abrir foto' : 'Abrir vídeo');
      const previewUrl = itemPreviewUrl(item);
      if (previewUrl) tile.style.backgroundImage = `url(${previewUrl})`;
      if (item.type === 'video') {
        tile.innerHTML = `<span class="video-badge">▶ ${formatDuration(item.duration)}</span>`;
      }
      tile.addEventListener('click', () => openViewer(item, 'gallery'));
      galleryGrid.appendChild(tile);
    });
  }

  function openGallery() {
    closeOptions();
    closePanel();
    renderGallery();
    galleryScreen.classList.remove('hidden');
  }

  function closeGallery() {
    galleryScreen.classList.add('hidden');
  }

  // ---------- Visualizador ----------

  function openViewer(item, from) {
    viewerItem = item;
    viewerFrom = from;
    const isVideo = item.type === 'video';
    reviewPhoto.classList.toggle('hidden', isVideo);
    reviewVideo.classList.toggle('hidden', !isVideo);
    reviewSoundButton.classList.toggle('hidden', !isVideo);
    if (isVideo) {
      reviewPhoto.removeAttribute('src');
      reviewVideo.src = item.url;
      if (item.posterUrl) reviewVideo.poster = item.posterUrl;
      reviewVideo.load();
      playVideo();
    } else {
      reviewVideo.pause();
      reviewVideo.removeAttribute('src');
      reviewPhoto.src = item.url;
    }
    galleryScreen.classList.add('hidden');
    reviewScreen.classList.remove('hidden');
  }

  function closeViewer() {
    reviewVideo.pause();
    reviewScreen.classList.add('hidden');
    viewerItem = null;
    if (viewerFrom === 'gallery') openGallery();
  }

  // Tenta tocar com som; se o navegador bloquear, toca mudo (o botão de som liga depois).
  function playVideo() {
    setVideoSound(true);
    const playing = reviewVideo.play();
    if (playing && playing.catch) {
      playing.catch(() => {
        setVideoSound(false);
        reviewVideo.play().catch(() => {});
      });
    }
  }

  function setVideoSound(on) {
    reviewVideo.muted = !on;
    reviewSoundButton.setAttribute('aria-pressed', String(on));
    reviewSoundButton.setAttribute('aria-label', on ? 'Desligar som' : 'Ligar som');
  }

  function deleteViewerItem() {
    if (!viewerItem) return;
    const index = gallery.indexOf(viewerItem);
    if (index !== -1) gallery.splice(index, 1);
    reviewVideo.pause();
    reviewVideo.removeAttribute('src');
    reviewPhoto.removeAttribute('src');
    URL.revokeObjectURL(viewerItem.url);
    updateThumbnail();
    closeViewer();
  }

  // ---------- Vídeo ----------

  function pickRecorderType() {
    const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }

  function captureFrameUrl() {
    const w = preview.videoWidth;
    const h = preview.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 480 / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (currentFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  function updateRecTime() {
    recTime.textContent = formatDuration((Date.now() - recordStart) / 1000).padStart(5, '0');
  }

  async function startRecording() {
    if (!currentStream || !window.MediaRecorder) {
      recTime.textContent = 'Este navegador não grava vídeo';
      cameraScreen.classList.add('rec-error');
      setTimeout(() => cameraScreen.classList.remove('rec-error'), 2500);
      return;
    }

    cameraScreen.classList.add('recording');
    const tracks = currentStream.getVideoTracks();
    try {
      recordAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tracks.push(...recordAudioStream.getAudioTracks());
    } catch (e) {
      recordAudioStream = null; // sem microfone: grava só a imagem
    }

    const type = pickRecorderType();
    try {
      recorder = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type } : undefined);
    } catch (e) {
      cameraScreen.classList.remove('recording');
      stopAudio();
      return;
    }
    recordChunks = [];
    recordPoster = captureFrameUrl();
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) recordChunks.push(e.data);
    };
    recorder.onstop = finishRecording;
    // Sem fatias: no iPhone o MP4 em pedaços pode sair impossível de tocar.
    recorder.start();
    recordStart = Date.now();
    updateRecTime();
    recordTimer = setInterval(updateRecTime, 250);
  }

  function stopAudio() {
    if (recordAudioStream) recordAudioStream.getTracks().forEach((t) => t.stop());
    recordAudioStream = null;
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    clearInterval(recordTimer);
    cameraScreen.classList.remove('recording');
  }

  function finishRecording() {
    stopAudio();
    const duration = (Date.now() - recordStart) / 1000;
    const blob = new Blob(recordChunks, { type: (recorder && recorder.mimeType) || 'video/webm' });
    recorder = null;
    recordChunks = [];
    if (!blob.size) return;
    const item = { type: 'video', url: URL.createObjectURL(blob), posterUrl: recordPoster, duration };
    addToGallery(item);
    openViewer(item, 'camera');
  }

  function isRecording() {
    return !!recorder && recorder.state === 'recording';
  }

  function onShutter() {
    if (captureMode === 'video') {
      if (isRecording()) stopRecording();
      else startRecording();
    } else {
      takePhoto();
    }
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
    closeOptions();
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
    centerActiveMode(true);
  }

  function centerActiveMode(smooth) {
    const wrap = document.querySelector('.mode-tabs-wrap');
    const active = wrap && wrap.querySelector('.active');
    if (!active) return;
    const left = active.offsetLeft - (wrap.clientWidth - active.offsetWidth) / 2;
    wrap.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }

  // ---------- Menu dos 6 pontinhos ----------

  function openOptions() {
    closePanel();
    cameraScreen.classList.add('options-open');
    optionsToggle.setAttribute('aria-expanded', 'true');
  }

  function closeOptions() {
    cameraScreen.classList.remove('options-open');
    optionsToggle.setAttribute('aria-expanded', 'false');
  }

  optionsToggle.addEventListener('click', () => {
    if (cameraScreen.classList.contains('options-open')) {
      closeOptions();
    } else {
      openOptions();
    }
  });

  optionItems.forEach((item) => {
    item.addEventListener('click', () => {
      const on = item.getAttribute('aria-checked') !== 'true';
      item.setAttribute('aria-checked', String(on));
    });
  });

  // ---------- Foco: tocar na imagem move o quadrado ----------

  preview.addEventListener('pointerdown', (e) => {
    if (cameraScreen.classList.contains('jo-open')) {
      closeJoPanel();
      return;
    }
    closeOptions();
    const rect = cameraScreen.getBoundingClientRect();
    focusBox.style.left = `${e.clientX - rect.left}px`;
    focusBox.style.top = `${e.clientY - rect.top}px`;
    focusBox.classList.remove('pulse');
    void focusBox.offsetWidth;
    focusBox.classList.add('pulse');
  });

  // ---------- Tela da Jô ----------

  function openJoPanel() {
    cameraScreen.classList.add('jo-open');
  }

  function closeJoPanel() {
    joInput.blur();
    cameraScreen.classList.remove('jo-open');
  }

  // Com o teclado aberto, o painel cabe só na parte visível da tela
  // e a logo fica menor para não ficar por baixo da caixa de texto.
  function fitJoPanelToKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    const keyboardOpen = window.innerHeight - vv.height > 120;
    joPanel.classList.toggle('kb-open', keyboardOpen);
    if (keyboardOpen) {
      const height = Math.min(vv.height - 16, Math.max(230, vv.height * 0.62));
      joPanel.style.top = `${vv.offsetTop + vv.height - height - 8}px`;
      joPanel.style.bottom = 'auto';
      joPanel.style.height = `${height}px`;
    } else {
      joPanel.style.top = '';
      joPanel.style.bottom = '';
      joPanel.style.height = '';
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitJoPanelToKeyboard);
    window.visualViewport.addEventListener('scroll', fitJoPanelToKeyboard);
  }
  joInput.addEventListener('focus', () => setTimeout(fitJoPanelToKeyboard, 300));
  joInput.addEventListener('blur', () => setTimeout(fitJoPanelToKeyboard, 300));

  // ---------- Foto anexada no chat ----------

  let joAttachedUrl = null;

  function openAttachSheet() {
    joAttachRow.innerHTML = '';

    const fromPhone = document.createElement('button');
    fromPhone.type = 'button';
    fromPhone.className = 'jo-attach-tile jo-attach-phone';
    fromPhone.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 3 3 3-3 5 5" /></svg><span>Do celular</span>`;
    fromPhone.addEventListener('click', () => joFile.click());
    joAttachRow.appendChild(fromPhone);

    const photos = gallery.filter((item) => item.type === 'photo');
    photos.forEach((item) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'jo-attach-tile';
      tile.style.backgroundImage = `url(${item.url})`;
      tile.setAttribute('aria-label', 'Usar esta foto');
      tile.addEventListener('click', () => setAttachment(item.url));
      joAttachRow.appendChild(tile);
    });
    if (!photos.length) {
      const hint = document.createElement('p');
      hint.className = 'jo-attach-hint';
      hint.textContent = 'As fotos que você tirar na câmera aparecem aqui.';
      joAttachRow.appendChild(hint);
    }

    joAttachSheet.classList.remove('hidden');
    joAttachButton.setAttribute('aria-expanded', 'true');
  }

  function closeAttachSheet() {
    joAttachSheet.classList.add('hidden');
    joAttachButton.setAttribute('aria-expanded', 'false');
  }

  function setAttachment(url) {
    joAttachedUrl = url;
    joAttachmentImg.src = url;
    joAttachment.classList.remove('hidden');
    closeAttachSheet();
  }

  function clearAttachment() {
    joAttachedUrl = null;
    joAttachmentImg.removeAttribute('src');
    joAttachment.classList.add('hidden');
  }

  joAttachButton.addEventListener('click', () => {
    if (joAttachSheet.classList.contains('hidden')) openAttachSheet();
    else closeAttachSheet();
  });

  joFile.addEventListener('change', () => {
    const file = joFile.files && joFile.files[0];
    if (file) setAttachment(URL.createObjectURL(file));
    joFile.value = '';
  });

  joAttachmentRemove.addEventListener('click', clearAttachment);

  joPanel.addEventListener('click', (e) => {
    if (!joAttachSheet.classList.contains('hidden') && !joAttachSheet.contains(e.target) && !joAttachButton.contains(e.target)) {
      closeAttachSheet();
    }
  });

  // ---------- Respostas da Jô (genéricas, servem para qualquer pedido) ----------

  const JO_REPLIES_PHOTO = [
    'Que referência incrível! 📸 Analisei as cores, a luz e o clima dessa foto e criei um estilo parecido pra você. É só tocar em Testar e apontar a câmera.',
    'Amei essa foto! ✨ Já entendi a vibe: copiei o tom das cores, o contraste e a luz pra sua próxima foto ficar no mesmo clima.',
    'Referência anotada! 🎨 Montei um estilo inspirado nessa imagem, com as mesmas cores e o mesmo brilho. Bora testar?',
  ];

  const JO_REPLIES_TEXT = [
    'Boa ideia! ✨ Criei um estilo pensado pra esse momento: luz ajustada, cores mais vivas e um toque de contraste pra sua foto ficar com cara de capa.',
    'Deixa comigo! 📷 Ajustei exposição, cores e nitidez pra combinar com o que você descreveu. Toque em Testar e faça a foto.',
    'Entendi o clima! 🌟 Montei um estilo exclusivo pra essa cena. Se quiser, toque no + e mande uma foto de referência que eu deixo ainda mais parecido.',
  ];

  const joReplyCount = { photo: 0, text: 0 };

  function showJoReply(status, withPhoto) {
    const kind = withPhoto ? 'photo' : 'text';
    const replies = withPhoto ? JO_REPLIES_PHOTO : JO_REPLIES_TEXT;
    const text = replies[joReplyCount[kind] % replies.length];
    joReplyCount[kind] += 1;

    status.classList.add('answered');
    const body = document.createElement('div');
    body.className = 'jo-reply';
    body.innerHTML = `<p class="jo-reply-text"></p><button type="button" class="jo-reply-test">✨ Testar estilo na câmera</button>`;
    body.querySelector('.jo-reply-text').textContent = text;
    body.querySelector('.jo-reply-test').addEventListener('click', closeJoPanel);
    status.querySelector('.jo-status-text').replaceWith(body);
    status.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  function sendJoMessage(text, photoUrl) {
    const idleLogoEl = document.getElementById('jo-logo-idle');
    const idleRect = idleLogoEl ? idleLogoEl.getBoundingClientRect() : null;
    // Na segunda mensagem a logo do meio já sumiu: não há o que animar.
    const startRect = idleRect && idleRect.width ? idleRect : null;

    let flyer = null;
    if (startRect) {
      flyer = idleLogoEl.cloneNode(true);
      flyer.removeAttribute('id');
      flyer.classList.add('jo-logo-flyer');
      flyer.style.position = 'fixed';
      flyer.style.left = `${startRect.left}px`;
      flyer.style.top = `${startRect.top}px`;
      flyer.style.width = `${startRect.width}px`;
      flyer.style.height = `${startRect.height}px`;
      flyer.style.margin = '0';
      document.body.appendChild(flyer);
    }

    joPanel.classList.add('has-sent');

    const userMsg = document.createElement('div');
    userMsg.className = 'jo-msg-user';
    if (photoUrl) {
      const thumb = document.createElement('img');
      thumb.className = 'jo-thumb';
      thumb.src = photoUrl;
      thumb.alt = 'Foto anexada';
      userMsg.appendChild(thumb);
    }
    if (text) {
      const bubble = document.createElement('p');
      bubble.className = 'jo-bubble';
      bubble.textContent = text;
      userMsg.appendChild(bubble);
    }
    joMessages.appendChild(userMsg);

    const status = document.createElement('div');
    status.className = 'jo-msg-status';
    status.innerHTML = `<span class="jo-logo loading" style="opacity:0">${JO_LOGO_SVG}</span><span class="jo-status-text looping">Analisando sua mensagem</span>`;
    joMessages.appendChild(status);
    joMessages.scrollIntoView({ block: 'end' });

    const statusLogo = status.querySelector('.jo-logo');

    if (flyer && statusLogo) {
      const endRect = statusLogo.getBoundingClientRect();
      const scaleX = endRect.width / startRect.width;
      const scaleY = endRect.height / startRect.height;
      const dx = endRect.left - startRect.left;
      const dy = endRect.top - startRect.top;

      flyer.style.transformOrigin = 'top left';
      flyer.style.transition = 'transform 550ms cubic-bezier(0.34, 1.1, 0.4, 1)';
      // Força o navegador a aplicar o estado inicial antes de animar.
      flyer.getBoundingClientRect();
      requestAnimationFrame(() => {
        flyer.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
      });

      setTimeout(() => {
        statusLogo.style.opacity = '1';
        flyer.remove();
      }, 560);
    } else if (statusLogo) {
      statusLogo.style.opacity = '1';
    }

    setTimeout(() => showJoReply(status, !!photoUrl), 2600);
  }

  function handleJoSend() {
    const text = joInput.value.trim();
    if (!text && !joAttachedUrl) return;
    closeAttachSheet();
    sendJoMessage(text, joAttachedUrl);
    joInput.value = '';
    clearAttachment();
  }

  joInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleJoSend();
  });

  joSendButton.addEventListener('click', handleJoSend);

  joCollapse.addEventListener('click', closeJoPanel);
  joTest.addEventListener('click', closeJoPanel);

  joOpenButton.addEventListener('click', () => {
    closeOptions();
    closePanel();
    openJoPanel();
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
      if (isRecording()) return;
      const mode = span.dataset.mode;
      setActiveMode(mode);
      captureMode = mode === 'video' ? 'video' : 'foto';
      cameraScreen.classList.toggle('mode-video', captureMode === 'video');
      if (mode === 'estilos') {
        openPanel();
      } else {
        closePanel();
      }
    });
  });

  zoomButtons.forEach((btn) => {
    btn.addEventListener('click', () => applyZoom(Number(btn.dataset.zoom)));
  });

  centerActiveMode(false);

  // ---------- Eventos gerais ----------

  startButton.addEventListener('click', startCamera);
  shutterButton.addEventListener('click', onShutter);
  flashToggle.addEventListener('click', toggleFlash);
  flipButton.addEventListener('click', () => {
    if (!isRecording()) flipCamera();
  });
  thumbnail.addEventListener('click', () => {
    if (!isRecording()) openGallery();
  });
  galleryBack.addEventListener('click', closeGallery);
  closeReviewButton.addEventListener('click', closeViewer);
  reviewGalleryButton.addEventListener('click', () => {
    reviewVideo.pause();
    reviewScreen.classList.add('hidden');
    viewerItem = null;
    openGallery();
  });
  reviewDeleteButton.addEventListener('click', deleteViewerItem);
  reviewSoundButton.addEventListener('click', () => setVideoSound(reviewVideo.muted));

  window.addEventListener('beforeunload', () => {
    gallery.forEach((item) => URL.revokeObjectURL(item.url));
    stopAudio();
    if (currentStream) currentStream.getTracks().forEach((track) => track.stop());
  });
})();
