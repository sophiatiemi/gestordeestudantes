(() => {
  const preview = document.getElementById('preview');
  const permissionOverlay = document.getElementById('permission-overlay');
  const permissionText = document.getElementById('permission-text');
  const startButton = document.getElementById('start-camera');

  const shutterButton = document.getElementById('shutter');
  const flashOverlay = document.getElementById('flash-overlay');
  const thumbnail = document.getElementById('thumbnail');

  const reviewScreen = document.getElementById('review-screen');
  const reviewPhoto = document.getElementById('review-photo');
  const closeReviewButton = document.getElementById('close-review');

  const captureCanvas = document.getElementById('capture-canvas');

  let currentPhotoUrl = null;
  let imageCapture = null;

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 7680 },
          height: { ideal: 4320 },
        },
        audio: false,
      });
      preview.srcObject = stream;
      permissionOverlay.classList.add('hidden');

      const [track] = stream.getVideoTracks();
      if (track && 'ImageCapture' in window) {
        try {
          imageCapture = new ImageCapture(track);
        } catch (e) {
          imageCapture = null;
        }
      }
    } catch (err) {
      permissionText.textContent =
        'Não foi possível acessar a câmera. Verifique se você permitiu o acesso e se está usando HTTPS, depois tente novamente.';
      startButton.textContent = 'Tentar novamente';
    }
  }

  async function takePhoto() {
    triggerFlash();

    if (imageCapture) {
      try {
        let photoSettings = undefined;
        try {
          const caps = await imageCapture.getPhotoCapabilities();
          if (caps.imageWidth && caps.imageHeight) {
            photoSettings = {
              imageWidth: caps.imageWidth.max,
              imageHeight: caps.imageHeight.max,
            };
          }
        } catch (e) {
          // getPhotoCapabilities() não suportado neste navegador — segue sem imageWidth/imageHeight explícitos.
        }
        const blob = await imageCapture.takePhoto(photoSettings);
        showPhoto(blob);
        return;
      } catch (err) {
        // Sensor não suportou takePhoto() nesta situação — cai para o método de vídeo abaixo.
      }
    }

    const width = preview.videoWidth;
    const height = preview.videoHeight;
    if (!width || !height) return;

    captureCanvas.width = width;
    captureCanvas.height = height;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(preview, 0, 0, width, height);

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

  startButton.addEventListener('click', startCamera);
  shutterButton.addEventListener('click', takePhoto);
  thumbnail.addEventListener('click', () => {
    if (currentPhotoUrl) openReview();
  });
  closeReviewButton.addEventListener('click', closeReview);

  window.addEventListener('beforeunload', () => {
    discardPhoto();
    const stream = preview.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
  });
})();
