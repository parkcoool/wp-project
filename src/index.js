const showScreen = (screenId) => {
  const screen = document.querySelector(`.screen#${screenId}`);
  if (screen) {
    document
      .querySelectorAll('.screen')
      .forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
  }
};

showScreen('menu-screen');
