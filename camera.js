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

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      preview.srcObject = stream;
      permissionOverlay.classList.add('hidden');
    } catch (err) {
      permissionText.textContent =
        'Não foi possível acessar a câmera. Verifique se você permitiu o acesso e se está usando HTTPS, depois tente novamente.';
      startButton.textContent = 'Tentar novamente';
    }
  }

  function takePhoto() {
    const width = preview.videoWidth;
    const height = preview.videoHeight;
    if (!width || !height) return;

    captureCanvas.width = width;
    captureCanvas.height = height;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(preview, 0, 0, width, height);

    captureCanvas.toBlob((blob) => {
      if (!blob) return;
      discardPhoto();
      currentPhotoUrl = URL.createObjectURL(blob);
      reviewPhoto.src = currentPhotoUrl;
      thumbnail.style.backgroundImage = `url(${currentPhotoUrl})`;
      thumbnail.disabled = false;
      openReview();
    }, 'image/jpeg', 0.92);

    triggerFlash();
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
