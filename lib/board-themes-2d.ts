export type BoardTheme2DId =
  | 'rennake_forest'
  | 'archiova_bronze'
  | 'vellure_sage'
  | 'nextgenix_emerald'
  | 'espresso_cream'
  | 'chesscom_green'
  | 'taupe_stone'
  | 'obsidian_ivory'
  | 'walnut_maple'
  | 'tournament_blue'
  | 'coral_sand'
  | 'emerald_marble';

export type PieceStyle2DId =
  | 'rennake_botanical'
  | 'archiova_bronze'
  | 'vellure_sage'
  | 'nextgenix_emerald'
  | 'neo_classic'
  | 'royal_editorial'
  | 'royal_gold'
  | 'minimal_tournament';

export interface BoardTheme2DPreset {
  id: BoardTheme2DId;
  name: string;
  subtitle: string;
  lightSquare: string;
  darkSquare: string;
  selectedSquare: string;
  lastMoveLight: string;
  lastMoveDark: string;
  coordOnLight: string;
  coordOnDark: string;
  borderOuter: string;
  arrowColor: string;
}

export const BOARD_THEMES_2D: Record<BoardTheme2DId, BoardTheme2DPreset> = {
  rennake_forest: {
    id: 'rennake_forest',
    name: 'Rennale Forest',
    subtitle: 'Botanical Emerald & Sand',
    lightSquare: '#E3DEC6',
    darkSquare: '#1F4031',
    selectedSquare: '#7A9A76',
    lastMoveLight: '#D0C9A8',
    lastMoveDark: '#2E5945',
    coordOnLight: '#1F4031',
    coordOnDark: '#E3DEC6',
    borderOuter: '#0D1C15',
    arrowColor: '#DFC29B',
  },
  archiova_bronze: {
    id: 'archiova_bronze',
    name: 'Archiova Bronze',
    subtitle: 'Architectural Warm Brown',
    lightSquare: '#E6D7C3',
    darkSquare: '#4E392B',
    selectedSquare: '#9C7A54',
    lastMoveLight: '#D6C1A4',
    lastMoveDark: '#694D3A',
    coordOnLight: '#4E392B',
    coordOnDark: '#E6D7C3',
    borderOuter: '#1E1610',
    arrowColor: '#DFC29B',
  },
  vellure_sage: {
    id: 'vellure_sage',
    name: 'Vellure Sage',
    subtitle: 'Organic Olive & Linen',
    lightSquare: '#EAE6DF',
    darkSquare: '#5E785D',
    selectedSquare: '#9AB396',
    lastMoveLight: '#D7D2C6',
    lastMoveDark: '#739172',
    coordOnLight: '#3F543E',
    coordOnDark: '#EAE6DF',
    borderOuter: '#19261C',
    arrowColor: '#291C0E',
  },
  nextgenix_emerald: {
    id: 'nextgenix_emerald',
    name: 'Nextgenix Tech',
    subtitle: 'Deep Matrix & Mint',
    lightSquare: '#D7E6DF',
    darkSquare: '#143328',
    selectedSquare: '#3B7A5E',
    lastMoveLight: '#B8D4C7',
    lastMoveDark: '#1E4B3B',
    coordOnLight: '#143328',
    coordOnDark: '#D7E6DF',
    borderOuter: '#091712',
    arrowColor: '#7A9A76',
  },
  espresso_cream: {
    id: 'espresso_cream',
    name: 'Espresso & Cream',
    subtitle: 'Klasik Hangat',
    lightSquare: '#E1D4C2',
    darkSquare: '#6E473B',
    selectedSquare: '#A78D78',
    lastMoveLight: '#D5C0A5',
    lastMoveDark: '#875849',
    coordOnLight: '#6E473B',
    coordOnDark: '#E1D4C2',
    borderOuter: '#291C0E',
    arrowColor: '#291C0E',
  },
  chesscom_green: {
    id: 'chesscom_green',
    name: 'Chess.com Green',
    subtitle: 'Standar Turnamen',
    lightSquare: '#EEEED2',
    darkSquare: '#769656',
    selectedSquare: '#BACA44',
    lastMoveLight: '#F6F669',
    lastMoveDark: '#BACA44',
    coordOnLight: '#769656',
    coordOnDark: '#EEEED2',
    borderOuter: '#1D2B1A',
    arrowColor: '#E58F2A',
  },
  taupe_stone: {
    id: 'taupe_stone',
    name: 'Taupe & Stone',
    subtitle: 'Editorial Lembut',
    lightSquare: '#E1D4C2',
    darkSquare: '#A78D78',
    selectedSquare: '#6E473B',
    lastMoveLight: '#CFC2B0',
    lastMoveDark: '#8E735E',
    coordOnLight: '#6E473B',
    coordOnDark: '#291C0E',
    borderOuter: '#6E473B',
    arrowColor: '#6E473B',
  },
  obsidian_ivory: {
    id: 'obsidian_ivory',
    name: 'Obsidian Ivory',
    subtitle: 'Kontras Gelap',
    lightSquare: '#BEB5A9',
    darkSquare: '#291C0E',
    selectedSquare: '#6E473B',
    lastMoveLight: '#A78D78',
    lastMoveDark: '#523624',
    coordOnLight: '#291C0E',
    coordOnDark: '#E1D4C2',
    borderOuter: '#291C0E',
    arrowColor: '#DFC29B',
  },
  walnut_maple: {
    id: 'walnut_maple',
    name: 'Walnut & Maple',
    subtitle: 'Kayu Staunton',
    lightSquare: '#EAE0C8',
    darkSquare: '#8B5A2B',
    selectedSquare: '#C18C5D',
    lastMoveLight: '#DFC99B',
    lastMoveDark: '#A66E38',
    coordOnLight: '#8B5A2B',
    coordOnDark: '#EAE0C8',
    borderOuter: '#3B2314',
    arrowColor: '#D97706',
  },
  tournament_blue: {
    id: 'tournament_blue',
    name: 'Icy Sea Blue',
    subtitle: 'Master Online',
    lightSquare: '#DEE3E6',
    darkSquare: '#4B7399',
    selectedSquare: '#729FCF',
    lastMoveLight: '#B7D0E8',
    lastMoveDark: '#5B8BB8',
    coordOnLight: '#4B7399',
    coordOnDark: '#DEE3E6',
    borderOuter: '#1E293B',
    arrowColor: '#F59E0B',
  },
  coral_sand: {
    id: 'coral_sand',
    name: 'Terracotta Sand',
    subtitle: 'Artisanal Hangat',
    lightSquare: '#F4EBE1',
    darkSquare: '#B0644F',
    selectedSquare: '#D4846A',
    lastMoveLight: '#E8D3BD',
    lastMoveDark: '#C4755E',
    coordOnLight: '#B0644F',
    coordOnDark: '#F4EBE1',
    borderOuter: '#4A251B',
    arrowColor: '#291C0E',
  },
  emerald_marble: {
    id: 'emerald_marble',
    name: 'Royal Emerald',
    subtitle: 'Marmer Zamrud',
    lightSquare: '#E6EDE8',
    darkSquare: '#3B6E5C',
    selectedSquare: '#5C9B84',
    lastMoveLight: '#C5DDD0',
    lastMoveDark: '#4B8570',
    coordOnLight: '#3B6E5C',
    coordOnDark: '#E6EDE8',
    borderOuter: '#1A332A',
    arrowColor: '#EAB308',
  },
};

export const BOARD_THEME_2D_LIST: BoardTheme2DPreset[] = Object.values(BOARD_THEMES_2D);

export interface PieceStyle2DPreset {
  id: PieceStyle2DId;
  name: string;
  description: string;
  whitePrimary: string;
  whiteSecondary: string;
  whiteAccent: string;
  whiteStroke: string;
  blackPrimary: string;
  blackSecondary: string;
  blackAccent: string;
  blackStroke: string;
  blackOuterRim: string;
  badgeStyle: 'crown' | 'gem' | 'minimal' | 'classic';
}

export const PIECE_STYLES_2D: Record<PieceStyle2DId, PieceStyle2DPreset> = {
  rennake_botanical: {
    id: 'rennake_botanical',
    name: 'Rennale Jade',
    description: 'Bidak gading hangat & hijau hutan zamrud khas Rennale',
    whitePrimary: '#F3ECE0',
    whiteSecondary: '#DFC29B',
    whiteAccent: '#5E785D',
    whiteStroke: '#152A20',
    blackPrimary: '#13281E',
    blackSecondary: '#264A39',
    blackAccent: '#7A9A76',
    blackStroke: '#09140E',
    blackOuterRim: '#DFC29B',
    badgeStyle: 'gem',
  },
  archiova_bronze: {
    id: 'archiova_bronze',
    name: 'Archiova Bronze',
    description: 'Bidak champagne pasir & perunggu arsitektural gelap',
    whitePrimary: '#F5E9D6',
    whiteSecondary: '#DFC29B',
    whiteAccent: '#8C6239',
    whiteStroke: '#261A12',
    blackPrimary: '#281C14',
    blackSecondary: '#4E3626',
    blackAccent: '#DFC29B',
    blackStroke: '#120C08',
    blackOuterRim: '#E6D7C3',
    badgeStyle: 'crown',
  },
  vellure_sage: {
    id: 'vellure_sage',
    name: 'Vellure Organic',
    description: 'Sentuhan linen alami & hijau zaitun lembut yang kalem',
    whitePrimary: '#F7F4EE',
    whiteSecondary: '#D8D2C5',
    whiteAccent: '#5E785D',
    whiteStroke: '#232E21',
    blackPrimary: '#283325',
    blackSecondary: '#465942',
    blackAccent: '#A6C0A2',
    blackStroke: '#141A12',
    blackOuterRim: '#EAE6DF',
    badgeStyle: 'gem',
  },
  nextgenix_emerald: {
    id: 'nextgenix_emerald',
    name: 'Nextgenix Cyber',
    description: 'Kontras modern obsidian dengan inti hijau zamrud bercahaya',
    whitePrimary: '#EAF4EF',
    whiteSecondary: '#C2DCD0',
    whiteAccent: '#10B981',
    whiteStroke: '#0D211A',
    blackPrimary: '#0E1F18',
    blackSecondary: '#1B3B2E',
    blackAccent: '#34D399',
    blackStroke: '#050D0A',
    blackOuterRim: '#6EE7B7',
    badgeStyle: 'crown',
  },
  neo_classic: {
    id: 'neo_classic',
    name: 'Neo Chess.com',
    description: 'Siluet tegas standar turnamen dengan kontras tinggi',
    whitePrimary: '#F9F6F0',
    whiteSecondary: '#E2D9CC',
    whiteAccent: '#6E473B',
    whiteStroke: '#23170B',
    blackPrimary: '#26211D',
    blackSecondary: '#3E3229',
    blackAccent: '#D5C5B3',
    blackStroke: '#140D06',
    blackOuterRim: '#E1D4C2',
    badgeStyle: 'classic',
  },
  royal_editorial: {
    id: 'royal_editorial',
    name: 'Royal Espresso',
    description: 'Detail mahkota dan aksen kerah berkelas bernuansa kopi',
    whitePrimary: '#E1D4C2',
    whiteSecondary: '#BEB5A9',
    whiteAccent: '#6E473B',
    whiteStroke: '#291C0E',
    blackPrimary: '#291C0E',
    blackSecondary: '#6E473B',
    blackAccent: '#DFC29B',
    blackStroke: '#120B06',
    blackOuterRim: '#E1D4C2',
    badgeStyle: 'crown',
  },
  royal_gold: {
    id: 'royal_gold',
    name: 'Imperial Gold',
    description: 'Kemewahan mutiara emas & batu onyx hitam kerajaan',
    whitePrimary: '#FDF5E6',
    whiteSecondary: '#EED6A7',
    whiteAccent: '#B48327',
    whiteStroke: '#2C1E0B',
    blackPrimary: '#1A1612',
    blackSecondary: '#3D3122',
    blackAccent: '#F59E0B',
    blackStroke: '#0A0806',
    blackOuterRim: '#FDE68A',
    badgeStyle: 'crown',
  },
  minimal_tournament: {
    id: 'minimal_tournament',
    name: 'Minimalist Pro',
    description: 'Vektor monokrom bersih tanpa distraksi untuk kalkulasi cepat',
    whitePrimary: '#FFFFFF',
    whiteSecondary: '#E4E4E7',
    whiteAccent: '#52525B',
    whiteStroke: '#18181B',
    blackPrimary: '#18181B',
    blackSecondary: '#27272A',
    blackAccent: '#D4D4D8',
    blackStroke: '#09090B',
    blackOuterRim: '#F4F4F5',
    badgeStyle: 'minimal',
  },
};

export const PIECE_STYLE_2D_LIST: PieceStyle2DPreset[] = Object.values(PIECE_STYLES_2D);
