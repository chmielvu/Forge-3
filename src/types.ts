import { KnowledgeGraph } from './lib/types/kgot';

export enum CharacterId {
  PLAYER = 'Subject_84',
  NICO = 'Subject_Nico',
  DARIUS = 'Subject_Darius',
  SILAS = 'Subject_Silas',
  THEO = 'Subject_Theo',
  PROVOST = 'FACULTY_SELENE',
  LOGICIAN = 'FACULTY_LOGICIAN',
  INQUISITOR = 'FACULTY_PETRA',
  CONFESSOR = 'FACULTY_CONFESSOR',
  ASTRA = 'FACULTY_ASTRA',
  PHYSICUS = 'FACULTY_PHYSICUS',
  LOYALIST = 'PREFECT_LOYALIST',
  OBSESSIVE = 'PREFECT_OBSESSIVE',
  DISSIDENT = 'PREFECT_DISSIDENT',
  NURSE = 'PREFECT_NURSE'
}

export type NarratorMode = 
  | 'MOCKING_JESTER' 
  | 'SEDUCTIVE_DOMINATRIX' 
  | 'CLINICAL_ANALYST' 
  | 'SYMPATHETIC_CONFIDANTE';

export interface YandereLedger {
  subjectId: string;
  physicalIntegrity: number;
  traumaLevel: number;
  shamePainAbyssLevel: number; // Used as a proxy for deep psychological distress/arousal mix
  hopeLevel: number;
  complianceScore: number;
  fearOfAuthority: number;
  desireForValidation: number;
  capacityForManipulation: number;
  traumaBonds: Record<string, number>;
  phase: 'alpha' | 'beta' | 'gamma';
}

export interface GraphNode {
  id: string;
  label: string;
  group: 'subject' | 'faculty' | 'prefect' | 'location';
  val: number;
  traits?: string[];
  ocean?: { O: number; C: number; E: number; A: number; N: number };
}

// Script Item for dialogue parsing
export interface ScriptItem {
  speaker: string;
  text: string;
  emotion?: string;
  audioStart?: number; // Calculated after audio generation
  audioEnd?: number;
}

export type LogEntry = 
  | { id: string; type: 'system'; content: string }
  | { id: string; type: 'thought'; content: string }
  | { id: string; type: 'narrative'; content: string; visualContext?: string; script?: ScriptItem[]; speaker?: string } 
  | { id: string; type: 'psychosis'; content: string; speaker?: string }; 

export enum MediaStatus {
  idle = 'idle',
  pending = 'pending',
  inProgress = 'inProgress',
  ready = 'ready',
  error = 'error'
}

export interface MultimodalTurn {
  id: string;
  turnIndex: number;
  text: string;
  script?: ScriptItem[]; 
  visualPrompt: string;
  imageStatus: MediaStatus;
  imageData?: string;
  imageError?: string;
  audioStatus: MediaStatus;
  audioUrl?: string;
  audioDuration?: number;
  audioAlignment?: Array<{ index: number; start: number; end: number; speaker: string }>; 
  audioError?: string;
  videoStatus: MediaStatus;
  videoUrl?: string;
  videoError?: string;
  metadata?: {
    ledgerSnapshot?: YandereLedger;
    activeCharacters?: string[];
    location?: string;
    tags?: string[];
    simulationLog?: string;
    directorDebug?: string;
    audioMarkup?: string;
  };
}

export interface MediaQueueItem {
  turnId: string;
  type: 'image' | 'audio' | 'video';
  prompt: string;
  narrativeText?: string;
  script?: ScriptItem[]; 
  target?: string | PrefectDNA;
  previousTurn?: MultimodalTurn;
  addedAt?: number;
  retries?: number;
  priority?: number; 
  errorMessage?: string; 
}

export interface CoherenceReport {
  hasText: boolean;
  hasImage: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isFullyLoaded: boolean;
  hasErrors: boolean;
  completionPercentage: number;
}

export type SubjectStatus = 'ACTIVE' | 'BROKEN' | 'ISOLATED' | 'COMPLIANT' | 'REBELLIOUS';

export interface SubjectState {
  id: string;
  name: string;
  archetype: string;
  status: SubjectStatus;
  willpower: number;
  compliance: number;
  trust: number;
  respect: number;
  currentLocation: string;
  visualCondition: string;
  flags: string[];
  injuries: string[]; 
}

export interface MultimodalSliceExports {
  multimodalTimeline: MultimodalTurn[];
  currentTurnId: string | null;
  mediaQueue: {
    pending: MediaQueueItem[];
    inProgress: MediaQueueItem[];
    failed: MediaQueueItem[];
  };
  audioPlayback: {
    currentPlayingTurnId: string | null;
    isPlaying: boolean;
    volume: number;
    playbackRate: number;
    autoAdvance: boolean;
    hasUserInteraction: boolean;
  };
  registerTurn: (
    text: string,
    visualPrompt: string,
    audioMarkup: string | undefined,
    metadata: MultimodalTurn['metadata'],
    script?: ScriptItem[]
  ) => MultimodalTurn;
  setCurrentTurn: (turnId: string) => void;
  goToNextTurn: () => void;
  goToPreviousTurn: () => void;
  getTurnById: (turnId: string) => MultimodalTurn | undefined;
  getTimelineStats: () => {
    totalTurns: number;
    loadedTurns: number;
    pendingMedia: number;
    failedMedia: number;
    completionRate: number;
  };
  pruneOldTurns: (keepCount: number) => void;
  enqueueMediaForTurn: (item: MediaQueueItem) => void;
  markMediaPending: (item: MediaQueueItem) => void;
  markMediaReady: (
    turnId: string,
    type: 'image' | 'audio' | 'video',
    dataUrl: string,
    duration?: number,
    alignment?: Array<{ index: number; start: number; end: number; speaker: string }>
  ) => void;
  markMediaError: (turnId: string, type: 'image' | 'audio' | 'video', errorMessage: string) => void;
  removeMediaFromQueue: (item: MediaQueueItem) => void;
  retryFailedMedia: (turnId: string, type?: 'image' | 'audio' | 'video') => void;
  regenerateMediaForTurn: (turnId: string, type?: 'image' | 'audio' | 'video') => void;
  playTurn: (turnId: string) => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;
  seekAudio: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleAutoAdvance: () => void;
  setHasUserInteraction: () => void;
  getCoherenceReport: (turnId: string) => CoherenceReport;
  resetMultimodalState: () => void;
}

export interface SubjectSliceExports {
  initializeSubjects: () => void;
  updateSubject: (id: string, updates: Partial<SubjectState>) => void;
  getSubject: (id: string) => SubjectState | undefined;
  triggerSubjectReaction: (playerActionType: 'COMPLY' | 'DEFY' | 'OBSERVE' | 'SPEAK', context: string) => void;
}

export type PrefectArchetype = 
  | 'The Zealot'
  | 'The Yandere'
  | 'The Dissident'
  | 'The Nurse'
  | 'The Sadist'
  | 'The Defector'
  | 'The Voyeur'
  | 'The Parasite'
  | 'The Perfectionist'
  | 'The Martyr'
  | 'The Wildcard'
  | 'The Mimic'
  | 'The Confessor'
  | 'The Logician'
  | 'The Provost'
  | 'The Pain Broker';

export interface TraitVector {
  cruelty: number;
  charisma: number;
  cunning: number;
  submission_to_authority: number;
  ambition: number;
}

export interface PrefectPsychometrics {
  tortureStyle: 'KINETIC' | 'CLINICAL' | 'EMOTIONAL' | 'RITUALISTIC' | 'INTIMATE' | 'PUBLIC'; 
  physiologicalTell: string; 
  breakingPointTrigger: string; 
  idleProp: string; 
  vocalQuirk?: string; 
  visualDNA?: string; 
  somaticSignature?: string; 
  dominance?: number; 
}

export interface PrefectDNA {
  id: string;
  displayName: string;
  archetype: PrefectArchetype;
  isCanon: boolean;
  traitVector: TraitVector;
  drive: string;
  secretWeakness: string;
  favorScore: number;
  relationships: Record<string, number>;
  currentEmotionalState?: {
      paranoia: number;
      desperation: number;
      confidence: number;
      dominance?: number; 
  };
  lastPublicAction?: string;
  knowledge?: string[];
  psychometrics?: PrefectPsychometrics; 
  appearanceDescription?: string; 
  narrativeFunctionDescription?: string; 
  promptKeywords?: string[]; 
  visualDNA?: string; 
  somaticSignature?: string; 
}

export interface GameState {
  ledger: YandereLedger;
  location: string;
  turn: number;
  nodes: GraphNode[]; 
  links: any[]; 
  seed: number;
  subjects: Record<string, SubjectState>; 
  prefects: PrefectDNA[]; 
}

export interface CombinedGameStoreState extends MultimodalSliceExports, SubjectSliceExports {
  gameState: GameState;
  kgot: KnowledgeGraph;
  logs: LogEntry[];
  choices: string[];
  sessionActive: boolean; 
  isThinking: boolean;
  isMenuOpen: boolean;
  isGrimoireOpen: boolean;
  isDevOverlayOpen: boolean;
  narratorOverride: NarratorMode | 'AUTO'; 
  executedCode?: string;
  lastSimulationLog?: string;
  lastDirectorDebug?: string;
  addLog: (log: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  setChoices: (choices: string[]) => void;
  setThinking: (isThinking: boolean) => void;
  setMenuOpen: (isOpen: boolean) => void;
  setGrimoireOpen: (isOpen: boolean) => void;
  setDevOverlayOpen: (isOpen: boolean) => void;
  setNarratorOverride: (mode: NarratorMode | 'AUTO') => void; 
  updatePrefects: (prefects: PrefectDNA[]) => void;
  updateGameState: (updates: Partial<GameState>) => void;
  updateLogMedia: (logId: string, media: Partial<LogEntry>) => void;
  applyServerState: (result: any) => void;
  applyDirectorUpdates: (response: any) => void;
  processPlayerTurn: (input: string) => void;
  resetGame: () => void;
  startSession: (isLiteMode?: boolean) => Promise<void>;
  saveSnapshot: () => Promise<void>;
  loadSnapshot: () => Promise<void>;
}

export interface PrefectDecision {
    prefectId: string;
    action: string; 
    actionDetail: string;
    publicUtterance: string | null;
    publicActionSummary: string | null; 
    hiddenProposal: string | null;
    targetId: string | null;
    stateDelta: any;
    confidence: number;
}

export interface PrefectThought {
  agentId: string;
  publicAction: string;
  hiddenMotivation: string;
  internalMonologue: string;
  sabotageAttempt: { target: string; method: string; deniability: number } | null;
  allianceSignal: { target: string; message: string };
  emotionalState: { paranoia: number; desperation: number; confidence: number };
  secretsUncovered: string[];
  favorScoreDelta: number;
}

export interface FilteredSceneContext {
  description: string;
  location: string;
  timeOfDay: string;
  otherPrefects: Array<{
    id: string; 
    name: string;
    recentActions: string;
    favorScore: number;
    perceivedThreat: number;
    psychometrics?: PrefectPsychometrics; 
    appearanceDescription?: string; 
  }>;
  yourFavorScore: number;
  yourRecentActions: string[];
  facultyPresent: string[];
  facultyMood: string;
  playerTrauma: number;
  recentRituals: string[];
  sceneFlags: string[];
  subjectRelationships: string[];
}

export interface CharacterVisualState {
  characterId: string;
  lastSeenTurn: number;
  clothingState: 'pristine' | 'disheveled' | 'torn' | 'bloodstained';
  emotionalState: string;
  injuries: string[];
  dominancePosture: number;
  facialExpression?: string; 
  poseDescription?: string; 
  activeProps?: string[]; 
}

export interface EnvironmentState {
  location: string;
  lightingScheme: string;
  atmosphericEffects: string[];
  dominantColors: string[];
  keyProps?: string[]; 
  surfaceMaterials?: string[]; 
  architecturalStyle?: string; 
}

export interface VisualMemory {
  lastCharacterAppearances: Map<string, CharacterVisualState>;
  environmentState: EnvironmentState;
  timeOfDay: string;
  weatherCondition: string;
  turnHistory: any[];
}

export interface VisualTurnSnapshot {
}