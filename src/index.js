document.addEventListener('DOMContentLoaded', () => {
  showScreen('menu-screen');

  const modalOpenBtn = document.querySelectorAll('.main-menu-btn');
  const modalBoxes = document.querySelectorAll('.main-menu-modal');
  modalOpenBtn.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      modalBoxes[index - 1]?.classList.add('active');
    });
  });

  const modalCloseBtn = document.querySelectorAll('.main-menu-modal-close-btn');
  modalCloseBtn.forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.parentElement.classList.remove('active');
    });
  });
});

const showScreen = (screenId) => {
  const screen = document.querySelector(`.screen#${screenId}`);
  if (screen) {
    document
      .querySelectorAll('.screen')
      .forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
  }
};
