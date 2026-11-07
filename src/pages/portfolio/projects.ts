/**
 * The 13 projects shown as stars in /portafolio. Texts were drafted from each
 * repository's README and code (2026-11-06) and are meant to grow: every
 * project has its own full screen, so new fields (screenshots, videos, role,
 * team, results...) can be added here and rendered in ProjectViewer.
 *
 * Order = order of the stars around the constellation and of the arrows.
 */

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectMedia {
  type: 'image' | 'video';
  src: string;
  alt: string;
}

export interface Project {
  /** Repository name on github.com/ozioziel */
  repo: string;
  name: string;
  tagline: string;
  /** Paragraphs of the explanation */
  summary: string[];
  highlights: string[];
  stack: string[];
  badges: string[];
  /** Short clarification shown under the text (e.g. testnet, no real money) */
  note?: string;
  links: ProjectLink[];
  /** Colour of its star (language / theme of the project) */
  color: string;
  /** Reserved for screenshots and videos, rendered when present */
  media?: ProjectMedia[];
}

const gh = (repo: string): ProjectLink => ({ label: 'Código en GitHub', href: `https://github.com/ozioziel/${repo}` });

export const PROJECTS: Project[] = [
  {
    repo: 'dawg',
    name: 'dawg',
    tagline: 'Tres aliens escapan del Área 51 en un juego web cooperativo para 3 jugadores.',
    summary: [
      'Juego online en vista cenital con estética de laboratorio caricaturesco. Esta demo cubre el Área 1 (Incubadoras): un tutorial, tres salas individuales, tres salas de dúo y el núcleo con el Jefe de laboratorio.',
      'Cada alien tiene su arma y su habilidad: el Cambiaformas se disfraza para que los soldados no lo ataquen, el alien Del mar convierte barriles, cajas y torretas en cobertura (y a los soldados en pulpos aliados) y el Inteligente usa telequinesis. Si un alien cae, deja su alma: un compañero puede recogerla y hacer los dos papeles.',
    ],
    highlights: [
      'Servidor autoritativo con lobby, partida, IA enemiga y director de oleadas',
      'Salas con código para jugar con amigos, pings y chat',
      'Bots para probar partidas completas de forma automática',
      'Mapa en formato Tiled y versión publicable en itch.io',
    ],
    stack: ['TypeScript', 'Phaser 3', 'Colyseus', 'Vite', 'Tiled', 'Docker', 'Caddy'],
    badges: ['Juego multijugador'],
    links: [gh('dawg')],
    color: '#5aa2ff',
  },
  {
    repo: 'Tilca-Go-',
    name: 'TilcaGo',
    tagline: 'Turistas con USDC en Stellar retiran bolivianos en efectivo en cajeros asociados de Bolivia.',
    summary: [
      'El pago queda protegido en un contrato inteligente Soroban hasta que el turista confirma la entrega en el mostrador. El turista cotiza (la tasa queda fija 10 minutos), elige un cajero que reserva su efectivo y firma el depósito con su wallet; TilcaGo paga la comisión de red, así que no necesita XLM.',
      'En el mostrador, el cajero valida un código QR con PIN de un solo uso, cuenta el efectivo a la vista y ve el pago confirmado en Stellar antes de entregar los billetes. Si nadie retira, el turista recupera sus USDC; si hay un problema, se abre una disputa que resuelve un árbitro.',
    ],
    highlights: [
      'Contrato de garantía (escrow) escrito en Rust con soroban-sdk',
      'App del turista y app del cajero, conectadas a la wallet Freighter',
      'Comisión de red patrocinada (fee-bump) para el turista',
      'App móvil para Android e iOS con Capacitor',
    ],
    stack: ['React 19', 'Vite', 'Fastify', 'PostgreSQL', 'Rust', 'Soroban', 'Stellar', 'Capacitor'],
    badges: ['Ideathon', 'Stellar Testnet'],
    note: 'Proyecto de ideathon: todo corre en Stellar Testnet con un activo de prueba; no se mueve dinero real.',
    links: [gh('Tilca-Go-')],
    color: '#f0c95a',
  },
  {
    repo: 'Workville',
    name: 'WorkVille',
    tagline: 'Un pueblo digital donde las personas ofrecen sus servicios, los encuentran y se pagan de forma segura con Stellar.',
    summary: [
      'Recorres un pueblo 2D dibujado en vectores, con cuatro villas (Creativo, Tech, Audiovisual y Academy) donde cada proveedor tiene su local: entras, ves sus servicios, hablas con él y lo contratas.',
      'Un interruptor cambia el modo de la villa: «Quiero contratar» muestra los locales de los proveedores y «Quiero trabajar» muestra los carteles «Se busca» para enviar propuestas. El pago queda en garantía en un contrato inteligente de Soroban hasta que el trabajo se entrega.',
    ],
    highlights: [
      'Tres formas de pago: directo, con garantía o por etapas',
      'Firma con wallet (también por QR) o entrando con tu correo',
      'Verificación de identidad, reportes y avisos',
      'Personas en línea caminando por la villa y chat por cercanía',
    ],
    stack: ['React 19', 'Phaser 3', 'NestJS 11', 'Prisma', 'Supabase', 'Rust', 'Soroban', 'Stellar'],
    badges: ['Stellar Testnet'],
    note: 'Versión en testnet: el dinero que se mueve no es real.',
    links: [gh('Workville')],
    color: '#7be0b0',
  },
  {
    repo: 'PenguinArcade',
    name: 'PenguinArcade',
    tagline: 'El frontend de una máquina arcade, hecho en Godot.',
    summary: [
      'Interfaz nativa para un mueble arcade: negro puro, una mascota pingüino en SVG, tipografía geométrica propia y navegación con flechas. Recorre los estados de la máquina: insertar moneda, modo de atracción con videos, selección de juego, lanzamiento y partida.',
      'Las monedas se convierten en créditos que se entregan al emulador a través de un puente en Lua para MAME. El catálogo de juegos se arma desde un archivo JSON: agregar un juego no requiere tocar el código.',
    ],
    highlights: [
      'Máquina de estados con créditos y temporizador de selección',
      'Integración con MAME y detección de RetroArch',
      'Catálogo dinámico con videos e imágenes por juego',
      'Estadísticas persistentes y recuperación segura de errores',
    ],
    stack: ['Godot 4.7', 'GDScript', 'MAME', 'Lua', 'JSON'],
    badges: ['Arcade'],
    links: [gh('PenguinArcade')],
    color: '#478cbf',
  },
  {
    repo: 'tic-network-hub',
    name: 'NetScope TIC',
    tagline: 'Sitio académico del Departamento de Redes de IATECH para la materia Gerencia de las TIC.',
    summary: [
      'Reúne Inicio, Gestión de Tecnología, Ciencia y Tecnología, Misión y Visión, Organigrama, Descripción de Puestos, Scrum y MBTI, con modo claro y oscuro en toda la navegación.',
      'Las secciones son interactivas: Scrum incluye el ciclo del Sprint, un tablero de práctica, un cuestionario y una biblioteca de recursos; MBTI permite explorar y comparar los perfiles del equipo, y Descripción de Puestos tiene búsqueda, filtros y manuales en PDF.',
    ],
    highlights: [
      'Tablero Scrum de práctica y cuestionario',
      'Organigrama y fichas de puestos con PDF descargables',
      'Animaciones de red en CSS/SVG que respetan el movimiento reducido',
      'Publicado en GitHub Pages con rutas internas',
    ],
    stack: ['React 19', 'Vite', 'TypeScript', 'React Router', 'Lucide React', 'CSS'],
    badges: ['Académico'],
    links: [gh('tic-network-hub')],
    color: '#9b8cff',
  },
  {
    repo: 'Stellar-Build',
    name: 'Stellar-Build',
    tagline: 'Un kit de skills para agentes de IA que acompañan todo el desarrollo de un proyecto en Stellar.',
    summary: [
      'Las skills siguen el recorrido de un proyecto en Stellar: idea, planificación, arquitectura, implementación, revisión y lanzamiento. Un enrutador indica qué skill usar según lo que se pide.',
      'Incluye roles (analista, product manager, diseñador UX, arquitecto) y temas técnicos como contratos Soroban, dApps y wallets, activos, pruebas de conocimiento cero y despliegue a mainnet.',
    ],
    highlights: [
      'Enrutador de skills por fase del proyecto',
      'Plantillas para PRD, arquitectura, épicas e historias',
      'Guías para contratos Soroban, wallets y activos',
      'Revisión de código y búsqueda de casos límite',
    ],
    stack: ['Claude Code', 'Markdown', 'Stellar', 'Soroban'],
    badges: ['IA'],
    links: [gh('Stellar-Build')],
    color: '#c58cff',
  },
  {
    repo: 'Rag-PinguinoSabio',
    name: 'Pingüino Sabio',
    tagline: 'Backend del asistente de conocimiento de ARTIKA, con RAG y memoria de conversaciones.',
    summary: [
      'Responde preguntas con una base de conocimiento propia: recupera los fragmentos relevantes con embeddings locales y búsqueda por similitud coseno en pgvector, y genera la respuesta con un modelo de lenguaje.',
      'La personalidad, la memoria, la recuperación y el proveedor del modelo viven en módulos separados: FastAPI es solo un adaptador HTTP y todo puede usarse también desde la línea de comandos.',
    ],
    highlights: [
      'Memoria de conversaciones en PostgreSQL',
      'Ingesta incremental: solo reprocesa documentos nuevos o modificados',
      'Proveedor de LLM intercambiable (xAI)',
      'Pruebas con dobles que no consumen créditos',
    ],
    stack: ['Python', 'FastAPI', 'PostgreSQL', 'pgvector', 'Alembic', 'Docker'],
    badges: ['IA · RAG'],
    links: [gh('Rag-PinguinoSabio')],
    color: '#4fd2ff',
  },
  {
    repo: 'PortalHipermaxi-Frontend',
    name: 'Asistente Maxi',
    tagline: 'Agente inteligente para el Portal de Proveedores de Hipermaxi, por texto y por voz.',
    summary: [
      'Prototipo creado por el equipo NexoLab durante InnovaHack 2026 para guiar a los proveedores dentro del portal, con orientación contextual y una base de conocimiento hecha con la documentación y los manuales. NexoLab ganó el primer lugar general con esta solución.',
      'Este repositorio es la primera etapa: una representación funcional del Portal de Proveedores para diseñar y validar la experiencia. Después de la competencia, el proyecto evolucionó a HyperFlow, un widget embebible con su propia API, voz y un microservicio RAG.',
    ],
    highlights: [
      'Asistencia por texto y por voz',
      'Orientación contextual dentro del portal',
      'Consulta de una base de conocimiento',
      'Demostración funcional presentada en InnovaHack 2026',
    ],
    stack: ['React', 'TypeScript', 'Vite', 'React Router', 'Recharts'],
    badges: ['1.er lugar InnovaHack 2026'],
    links: [gh('PortalHipermaxi-Frontend'), { label: 'HyperFlow (etapa 2)', href: 'https://github.com/daniel69zz/hipermaxi_innova' }],
    color: '#ff8a5c',
  },
  {
    repo: 'PenguinGraph',
    name: 'PenguinGraph',
    tagline: 'Una aplicación web para crear, editar y analizar grafos de forma visual.',
    summary: [
      'Permite dibujar vértices y aristas sobre un lienzo, con grafos dirigidos o no dirigidos, nombres, pesos y auto-conexiones. La matriz de adyacencia se genera sola y los grafos se exportan e importan en JSON para seguir trabajando después.',
      'Nació como un proyecto educativo de teoría de grafos: incluye una herramienta que muestra paso a paso el cálculo de la ruta crítica, con los recorridos hacia adelante y hacia atrás, las holguras y las aristas críticas.',
    ],
    highlights: [
      'Editor con arrastrar y soltar y paneles de edición',
      'Matriz de adyacencia automática',
      'Ruta crítica visualizada paso a paso',
      'Grafo dibujado con SVG y lógica propia en React',
    ],
    stack: ['React', 'JavaScript', 'Vite', 'React Router', 'Styled Components', 'SVG'],
    badges: ['Demo en línea'],
    links: [
      gh('PenguinGraph'),
      { label: 'Demo', href: 'https://1penguingraph.netlify.app' },
      { label: 'Demo V2', href: 'https://grafos-algoritmos.vercel.app/' },
    ],
    color: '#e7c52a',
  },
  {
    repo: 'mapia',
    name: 'MAPIA',
    tagline: 'Un mapa de alertas ciudadanas: la gente reporta lo que pasa en su zona y lo ve ubicado en el mapa.',
    summary: [
      'App móvil y web donde los usuarios reportan incidentes, como marchas, bloqueos o disturbios, que aparecen en el mapa con su zona, su gravedad y cuántas personas los reportaron.',
      'Además del mapa incluye publicaciones, noticias, eventos, perfiles, varios idiomas y un chatbot. El backend expone una API documentada con Swagger y guarda los datos geográficos en PostgreSQL con PostGIS.',
    ],
    highlights: [
      'Alertas geolocalizadas con nivel de gravedad',
      'App en Flutter para web y Android',
      'API en NestJS con autenticación JWT',
      'Integración con Google Maps e IA (Groq y Gemini)',
    ],
    stack: ['Flutter', 'Dart', 'NestJS', 'PostgreSQL', 'PostGIS', 'Supabase', 'Google Maps'],
    badges: ['Web y Android'],
    links: [gh('mapia')],
    color: '#00c2b2',
  },
  {
    repo: 'GeTa-Frontend',
    name: 'GeTa',
    tagline: 'Una red social para estudiantes, organizada por carrera.',
    summary: [
      'Al registrarse, cada estudiante elige su carrera y entra a un inicio con publicaciones, comentarios, mensajes, notificaciones, búsqueda y un panel para explorar.',
      'Es un proyecto full stack: el frontend en React consume una API en NestJS, y el esquema de la base de datos con las carreras iniciales se instala en Supabase/PostgreSQL.',
    ],
    highlights: [
      'Registro, inicio de sesión y selección de carrera',
      'Feed con publicaciones y comentarios',
      'Mensajes, notificaciones y búsqueda',
      'Perfil de usuario',
    ],
    stack: ['React', 'TypeScript', 'Vite', 'NestJS', 'PostgreSQL', 'Supabase'],
    badges: ['Full stack'],
    links: [gh('GeTa-Frontend')],
    color: '#3178c6',
  },
  {
    repo: 'HuellitasFind-TecnologiasWeb',
    name: 'HuellitasFind',
    tagline: 'Sitio de reservas para un centro de cuidado animal, conectado a un Arduino con GPS.',
    summary: [
      'Página para «Huellitas»: galería con videos, servicios (corte de pelo, baño, vacunación y consulta médica), ubicación, formulario de reserva, el equipo y un chatbot.',
      'Un servidor en Node.js lee las coordenadas que envía un módulo GPS NEO-8M conectado a un Arduino por puerto serie y las manda al sitio por WebSockets, para mostrar el recorrido sin recargar la página.',
    ],
    highlights: [
      'Reservas por servicio con su duración',
      'Lectura del GPS por puerto serie (serialport)',
      'Coordenadas en tiempo real con WebSockets',
      'Chatbot integrado',
    ],
    stack: ['Vue 3', 'Vite', 'Node.js', 'Express', 'WebSockets', 'Arduino', 'GPS NEO-8M'],
    badges: ['Web + hardware'],
    links: [gh('HuellitasFind-TecnologiasWeb')],
    color: '#41b883',
  },
  {
    repo: 'Lama',
    name: 'Lama',
    tagline: 'Proyecto en preparación.',
    summary: [
      'El repositorio se creó el 17 de octubre de 2026 y todavía no tiene código publicado. Pronto habrá más sobre este proyecto.',
    ],
    highlights: [],
    stack: [],
    badges: ['Próximamente'],
    links: [gh('Lama')],
    color: '#d8dde6',
  },
];
