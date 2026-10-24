// Apresentação do Jô: 5 telas antes da câmera. Ao terminar (ou pular),
// some e deixa à mostra o aviso da câmera, que fica até a pessoa tocar
// em "Ativar câmera".
(function () {
  const root = document.getElementById('onboarding');
  if (!root) return;

  const track = document.getElementById('ob-track');
  const slides = Array.from(track.querySelectorAll('.ob-slide'));
  const dots = Array.from(root.querySelectorAll('.ob-dots span'));
  const nextButton = document.getElementById('ob-next');
  const backButton = document.getElementById('ob-back');
  const skipButtons = [document.getElementById('ob-skip'), document.getElementById('ob-skip-intro')];

  const LABELS = ['Conhecer a câmera', 'Continuar', 'Continuar', 'Continuar', 'Criar Estilo'];
  let index = 0;

  function render() {
    root.classList.toggle('on-intro', index === 0);
    dots.forEach((dot, i) => dot.classList.toggle('on', i === index - 1));
    nextButton.textContent = LABELS[index];
  }

  function goTo(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    render();
  }

  function finish() {
    root.classList.add('leaving');
    setTimeout(() => root.remove(), 360);
  }

  // Arrastar com o dedo também troca de tela.
  let scrollTimer = null;
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== index) {
        index = i;
        render();
      }
    }, 80);
  });

  nextButton.addEventListener('click', () => {
    if (index === slides.length - 1) finish();
    else goTo(index + 1);
  });
  backButton.addEventListener('click', () => goTo(index - 1));
  skipButtons.forEach((btn) => btn.addEventListener('click', finish));
  window.addEventListener('resize', () => {
    track.scrollLeft = index * track.clientWidth;
  });

  render();
})();
