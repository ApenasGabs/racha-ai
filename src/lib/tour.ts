import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_PREFIX = 'racha_ai_tour_seen_v1_';

export type TourScope = 'landing' | 'host' | 'guest';

export const hasSeenTour = (scope: TourScope): boolean => {
  try {
    return localStorage.getItem(`${TOUR_STORAGE_PREFIX}${scope}`) === '1';
  } catch {
    return true;
  }
};

export const markTourSeen = (scope: TourScope): void => {
  try {
    localStorage.setItem(`${TOUR_STORAGE_PREFIX}${scope}`, '1');
  } catch {
    // ignore
  }
};

const getStepsForScope = (scope: TourScope): DriveStep[] => {
  if (scope === 'landing') {
    return [
      {
        element: '[data-tour="byok-btn"]',
        popover: {
          title: '1. Chave grátis de IA (BYOK)',
          description:
            'Configure sua chave gratuita da Groq (leva 30s, sem cartão) para o app ler a foto da nota fiscal automaticamente. Ela fica salva só no seu celular!',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="create-room"]',
        popover: {
          title: '2. Abra a mesa em 1 clique',
          description:
            'Dê um nome para a mesa e clique aqui para gerar o QR Code. Todos os dados ficam somente no seu dispositivo!',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '[data-tour="join-room"]',
        popover: {
          title: 'Ou entre em uma mesa',
          description:
            'Se um amigo já abriu a mesa, basta escanear o QR Code dele ou digitar o código aqui.',
          side: 'top',
          align: 'center',
        },
      },
    ];
  }

  if (scope === 'host') {
    return [
      {
        element: '[data-tour="header-qr"]',
        popover: {
          title: 'QR Code sempre no topo',
          description:
            'Toque aqui a qualquer momento para mostrar o QR Code em tela cheia e chamar o pessoal para a mesa ao vivo.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="receipt-scanner"]',
        popover: {
          title: 'Foto da Nota ou Item Manual',
          description:
            'Fotografe a nota fiscal para listar todos os itens e os 10% automaticamente — ou adicione itens manualmente.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="manual-person"]',
        popover: {
          title: 'Nem todo mundo precisa entrar!',
          description:
            'Inclua aqui quem está sem celular ou não escaneou o QR. Depois toque no nome da pessoa na barra para marcar os itens dela.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="tab-summary"]',
        popover: {
          title: 'Resumo & Pagar por mais pessoas',
          description:
            'Aqui você vê o total de cada um, pode assumir a parte de outras pessoas (ex: casal/amigos) e copiar o fechamento pronto pro WhatsApp!',
          side: 'top',
          align: 'end',
        },
      },
    ];
  }

  // guest
  return [
    {
      element: '[data-tour="participants-bar"]',
      popover: {
        title: 'Escolha seus itens',
        description:
          'Toque em "Entrar" nos itens que você consumiu. Você também pode adicionar pessoas manuais e marcar itens por elas!',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="tab-summary"]',
      popover: {
        title: 'Seu total ao vivo',
        description:
          'Veja quanto deu a sua parte com taxa de serviço e, se quiser, marque "Pagar por mais alguém" para somar a conta de outra pessoa com a sua.',
        side: 'top',
        align: 'end',
      },
    },
  ];
}

export const startTour = (scope: TourScope): void => {
  const allSteps = getStepsForScope(scope);
  // Filtra apenas passos cujo elemento está visível no DOM atual
  const availableSteps = allSteps.filter((step) => {
    if (typeof step.element !== 'string') return true;
    return Boolean(document.querySelector(step.element));
  });

  if (availableSteps.length === 0) return;

  const instance = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: '#000000',
    overlayOpacity: 0.78,
    stagePadding: 8,
    stageRadius: 14,
    popoverClass: 'racha-tour-popover',
    nextBtnText: 'Próximo →',
    prevBtnText: '← Voltar',
    doneBtnText: 'Entendi!',
    progressText: '{{current}} de {{total}}',
    onDestroyed: () => {
      markTourSeen(scope);
    },
    steps: availableSteps,
  });

  instance.drive();
}
