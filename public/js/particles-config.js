// Configuração do tsParticles
(async () => {
  await tsParticles.load({
    id: "particles-container", // Este ID deve ser o mesmo que colocamos no HTML
    options: {
      background: {
        color: {
          value: "transparent" // Fundo transparente (vamos usar o degradê do CSS)
        },
      },
      fpsLimit: 60, // Limita o FPS para economizar processador
      particles: {
        color: {
          value: "#888888" // Cor das partículas e linhas (um cinza médio)
        },
        links: {
          color: "#888888", // Cor das linhas que conectam
          distance: 150,     // Distância máxima para uma linha conectar
          enable: true,
          opacity: 0.5,
          width: 1          // Espessura da linha (bem fina)
        },
        move: {
          direction: "none",
          enable: true,
          outModes: "out",
          random: false,
          speed: 1, // Velocidade do movimento das partículas
          straight: false
        },
        number: {
          density: {
            enable: true,
          },
          value: 80, // Quantidade de partículas na tela
        },
        opacity: {
          value: 0.5, // Opacidade das partículas
        },
        shape: {
          type: "circle", // O formato da partícula (de onde saem as linhas)
        },
        size: {
          value: { min: 1, max: 3 }, // Tamanho das partículas
        },
      },
      interactivity: {
        events: {
          onHover: {
            enable: true,
            mode: "grab" // Efeito de "pegar" linha ao passar o mouse
          },
          onClick: {
            enable: false, // Sem efeito ao clicar
          }
        },
        modes: {
          grab: {
            distance: 140,
            links: {
              opacity: 0.8
            }
          }
        }
      },
      detectRetina: true,
    },
  });
})();