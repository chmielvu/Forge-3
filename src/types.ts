

export enum CharacterId {
  PROVOST = 'Provost_Selene',
  LOGICIAN = 'Dr_Lysandra',
  INQUISITOR = 'Petra',
  CONFESSOR = 'Calista',
  ASTRA = 'Dr_Astra',
  PHYSICUS = 'Mara_Curatus',
  NURSE = 'Anya',
  PLAYER = 'Subject_84',
  OBSESSIVE = 'Kaelen',
  LOYALIST = 'Elara',
  DISSIDENT = 'Rhea'
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  val: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
  weight: number;
}

export interface LogEntry {
  id: string;
  type: 'system' | 'narrative' | 'thought' | 'tool_output';
  content: string;
  visualContext?: string; 
  imageData?: string; 
  audioData?: string; 
  videoData?: string; 
}

// --- CORE GAME STATE ---

export interface YandereLedger {
  subjectId: string;
  physicalIntegrity: number;
  traumaLevel: number;
  shamePainAbyssLevel: number;
  hopeLevel: number;
  complianceScore: number;
  fearOfAuthority: number;
  desireForValidation: number;
  capacityForManipulation: number;
  arousalLevel: number;
  prostateSensitivity: number;
  ruinedOrgasmCount: number;
  castrationAnxiety: number;
  traumaBonds: Record<string, number>;
  phase: 'alpha' | 'beta' | 'gamma';
}

export interface GameState {
  ledger: YandereLedger;
  nodes: GraphNode[];
  links: GraphLink[];
  turn: number;
  location: string;
}

// Legacy Director Output (UI Consumption)
export interface DirectorOutput {
  thought_process: string;
  narrative: string;
  visual_prompt: string; 
  state_updates?: Partial<YandereLedger>;
  executed_code?: string;
  graph_updates?: {
    nodes_added?: GraphNode[];
    nodes_removed?: string[];
    edges_added?: { source: string; target: string; relation: string; weight: number }[];
    edges_removed?: { source: string; target: string }[];
  };
  choices: string[];
  simulationLog?: string; // ADDED
  debugTrace?: string; // ADDED
}

// New Director Response Schema (PROMPT 6)
export interface DirectorResponse {
  scenePlan: {
    planId: string;
    selectedActions: Array<{
      actorType: "faculty"|"prefect"|"player"|"system";
      actorId: string;
      actionType: string;
      actionDetail: string;
      targetId: string|null;
      publicUtterance: string|null;
    }>;
    executionOrder: string[];
    safetyFlags: string[];
  };
  ledgerDelta: Partial<YandereLedger>;
  // Explicit graph delta for Director Prompt 6
  graphDelta?: {
      edges_added?: Array<{ source: string; target: string; relation: string; weight: number }>;
      edges_removed?: Array<{ source: string; target: string }>;
  };
  publicRender: string;
  directorDecisions: {
    acceptedProposals: Array<{ origin: string; summary: string }>;
    rejectedProposals: Array<{ origin: string; reason: string }>;
    modifiedProposals: Array<{ origin: string; newProposal: string }>;
  };
  agentDirectives: Array<{ agentId: string; directiveType: string; payload: any }>;
  visualAudioAssets: Array<{ id: string; visualPrompt: any; audioPrompt: any; seed: number }>;
  debugTrace: string | null;
  choices: string[];
}


export type ToolMode = 'ANALYZE' | 'REANIMATE' | 'DISTORT';

// --- AGENT SYSTEM TYPES ---

export type OceanTraits = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
};

export type AgentArchetype = 'DOMINANT' | 'ANALYTICAL' | 'SADISTIC' | 'NURTURING' | 'SUBVERSIVE' | 'OBSESSIVE' | 'LOYALIST';

export interface NPCAgentState {
  id: CharacterId;
  name: string;
  archetype: AgentArchetype;
  traits: OceanTraits;
  visualSummary: string;
  currentIntent: string;
  obsessionLevel: number;
}

// --- NEW PREFECT SYSTEM ---

export type PrefectArchetype = 
  | 'The Zealot' | 'The Yandere' | 'The Dissident' | 'The Nurse'
  | 'The Sadist' | 'The Perfectionist' | 'The Voyeur' | 'The Martyr'
  | 'The Parasite' | 'The Wildcard' | 'The Defector' | 'The Mimic'
  | 'The Brat Princess' | 'The Siren' | 'The Psychologist' | 'The Contender';

export interface PrefectDNA {
  id: string; 
  displayName: string;
  archetype: PrefectArchetype;
  isCanon: boolean;
  traitVector: {
    cruelty: number;
    charisma: number;
    cunning: number;
    submission_to_authority: number;
    ambition: number;
  };
  drive: string;
  secretWeakness: string;
  favorScore: number;
  relationships: Record<string, number>;
  traumaBondLevel?: number;
}

export interface PrefectPrivateState {
  hiddenGoals: string[];
  grudges: Record<string, number>;
  trust: Record<string, number>;
  lastAction: string | null;
  cooldowns: Record<string, number>;
}

export type PrefectAction = "speak"|"act"|"intervene"|"observe"|"research"|"plot"|"probe"|"seduce"|"punish"|"console"|"offerTrade"|"sabotage";

export interface PrefectDecision {
  prefectId: string;
  action: PrefectAction;
  actionDetail: string;
  publicUtterance: string | null;
  hiddenProposal: string | null;
  targetId: string | null;
  stateDelta: Partial<PrefectPrivateState> & { favorScoreDelta?: number };
  confidence: number;
}

export interface PrefectThought {
  agentId: string;
  publicAction: string;
  hiddenMotivation: string;
  internalMonologue: string;
  sabotageAttempt?: {
    target: string;
    method: string;
    deniability: number;
  };
  allianceSignal?: {
    target: string;
    message: string;
  };
  emotionalState: {
    paranoia: number;
    desperation: number;
    confidence: number;
  };
  secretsUncovered: string[];
  favorScoreDelta: number;
}

// --- MARA & FACULTY SYSTEMS ---

export interface MaraDNA {
  id: string;
  displayName: string;
  archetype: string;
  traitVector: {
    cruelty: number;
    charisma: number;
    cunning: number;
    submission_to_authority: number;
    ambition: number;
  };
  drive: string;
  secretWeakness: string;
  favorScore: number;
  relationships: Record<string, number>;
  moralDecay: number;
}

export interface MaraThought {
  publicAction: string;
  hiddenDefiance: string;
  internalMonologue: string;
  documentedEvidence: string[];
  moralDecay: number;
  exitPlan: string;
  subjectSupport?: {
    target: string;
    method: string;
  };
}

export interface MaraContext {
  moralDecay: number;
  facultySuspicion: number;
  location: string;
  timeOfDay: string;
  description: string;
  facultyMood: string;
  prefects: { name: string; favorScore: number }[];
  playerTrauma: number;
  recentRituals: string[];
}

export interface FacultyCollectiveOutput {
  publicNarration: string;
  facultyActions: Array<{
    facultyId: "selene" | "lysandra" | "petra" | "calista" | "astra";
    actionType: "observe"|"direct"|"intervene"|"authorize"|"challenge"|"record"|"sanction"|"console"|"assignPrefect"|"callTrial";
    actionDetail: string;
    targetId: string|null;
    publicUtterance: string|null;
    confidence: number;
  }>;
  privateBundle: {
    seedUsed: number;
    perFacultyPrivate: Record<string, { hiddenProposal: string|null, privateStateDelta: any }>;
  };
  ledgerUpdates: { delta: Partial<YandereLedger> };
  visualCueHints: Array<{ assetType: string, promptTemplate: any; seed: number }>;
  debugTrace: string|null;
}

export interface OrchestratorOutput {
  prefectDecisions: PrefectDecision[];
  maraThought: MaraThought;
  facultyOutput: FacultyCollectiveOutput;
  simulationLog: string;
}

export interface FilteredSceneContext {
  description: string;
  location: string;
  timeOfDay: string;
  otherPrefects: Array<{
    name: string;
    recentActions: string;
    favorScore: number;
    perceivedThreat: number;
  }>;
  yourFavorScore: number;
  yourRecentActions: string[];
  facultyPresent: string[];
  facultyMood: string;
  playerTrauma: number;
  recentRituals: string[];
  sceneFlags: string[];
}

// --- MULTIMODAL SYSTEM TYPES ---
export enum MediaStatus {
  idle = 'idle',
  pending = 'pending',
  inProgress = 'inProgress', 
  ready = 'ready',
  error = 'error',
}

export interface MultimodalTurn {
  id: string; // Matches log entry ID
  turnIndex: number; // Sequential turn number
  text: string; // Canonical narrative text
  visualPrompt?: string; // JSON visual prompt
  
  // Media status tracking
  imageStatus: MediaStatus;
  imageData?: string;
  imageError?: string; // Added error field
  
  audioStatus: MediaStatus;
  audioUrl?: string; // Base64 audio string
  audioDuration?: number; // In seconds
  audioError?: string; // Added error field
  
  videoStatus: MediaStatus;
  videoUrl?: string; // Base64 video string (or blob URL)
  videoError?: string; // Added error field
  
  // Metadata for coherence, debug, etc.
  metadata?: {
    ledgerSnapshot: YandereLedger;
    activeCharacters: string[];
    location: string;
    tags: string[];
    simulationLog?: string;
    directorDebug?: string;
  };
}

export interface MediaQueueItem {
  turnId: string;
  type: 'image' | 'audio' | 'video'; 
  prompt: string; // This will now be the fully coherent JSON string for images
  narrativeText?: string; // For audio generation
  target?: PrefectDNA | CharacterId | string; // Added for buildVisualPrompt context, updated to allow string
  previousTurn?: MultimodalTurn; // Added for buildVisualPrompt context
  retries?: number; 
  addedAt?: number; 
  errorMessage?: string; 
}

export interface AudioPlaybackState {
  currentPlayingTurnId: string | null;
  isPlaying: boolean;
  // currentTime REMOVED: Managed by AudioService/Local State
  volume: number; // 0-1
  playbackRate: number; // 0.5x, 1x, 1.5x, 2x
  autoAdvance: boolean; // Play next turn automatically
  hasUserInteraction: boolean; // Required for autoplay in browsers
  // currentAudioSource REMOVED: Managed by AudioService
}

export interface CoherenceReport {
  hasText: boolean;
  hasImage: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isFullyLoaded: boolean;
  hasErrors: boolean;
  completionPercentage: number; // % of modalities loaded
}

// --- VISUAL COHERENCE ENGINE TYPES ---
export interface VisualMemory {
  lastCharacterAppearances: Map<string, CharacterVisualState>;
  environmentState: EnvironmentState;
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
  weatherCondition: string;
  turnHistory: VisualTurnSnapshot[];
}

export interface CharacterVisualState {
  characterId: string;
  lastSeenTurn: number;
  clothingState: 'pristine' | 'disheveled' | 'torn' | 'bloodstained';
  emotionalState: 'composed' | 'agitated' | 'broken' | 'ecstatic' | 'desirous' | 'humiliated' | 'terrified' | 'despairing';
  injuries: string[];
  dominancePosture: number; // 0-1
}

export interface EnvironmentState {
  location: string;
  lightingScheme: string;
  atmosphericEffects: string[];
  dominantColors: string[];
}

export interface VisualTurnSnapshot {
  turnId: string;
  turnIndex: number;
  dominantCharacterId: string; // Changed from dominantCharacter (string name) to ID
  location: string;
  emotionalTone: string;
}

// --- ZUSTAND STORE TYPES ---

// Interface for the Multimodal Slice
export interface MultimodalSliceExports {
  multimodalTimeline: MultimodalTurn[];
  currentTurnId: string | null;
  mediaQueue: {
    pending: MediaQueueItem[];
    inProgress: MediaQueueItem[];
    failed: MediaQueueItem[];
  };
  audioPlayback: AudioPlaybackState;

  // Timeline Actions
  registerTurn: (
    text: string,
    visualPrompt: string,
    metadata?: Partial<MultimodalTurn['metadata']>
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

  // Media Queue Actions
  enqueueMediaForTurn: (item: MediaQueueItem) => void;
  markMediaPending: (item: MediaQueueItem) => void;
  markMediaReady: (
    turnId: string,
    type: 'image' | 'audio' | 'video',
    dataUrl: string,
    duration?: number
  ) => void;
  markMediaError: (turnId: string, type: 'image' | 'audio' | 'video', errorMessage: string) => void;
  removeMediaFromQueue: (item: MediaQueueItem) => void;
  retryFailedMedia: (turnId: string, type?: 'image' | 'audio' | 'video') => void;

  // Audio Playback Actions
  playTurn: (turnId: string) => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;
  seekAudio: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleAutoAdvance: () => void;
  setHasUserInteraction: () => void;

  // Utility Actions
  getCoherenceReport: (turnId: string) => CoherenceReport;
  resetMultimodalState: () => void;
}

// Interface for the Full Game Store
export interface CombinedGameStoreState extends MultimodalSliceExports {
  // Core Game State
  gameState: GameState;
  logs: LogEntry[]; 
  choices: string[];
  
  // UI Flags
  isThinking: boolean;
  isMenuOpen: boolean;
  isGrimoireOpen: boolean;
  isDevOverlayOpen: boolean;
  
  // Dev / Debug Data
  executedCode?: string;
  lastSimulationLog?: string;
  lastDirectorDebug?: string;

  // Core Game Actions
  addLog: (log: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  setChoices: (choices: string[]) => void;
  setThinking: (isThinking: boolean) => void;
  setMenuOpen: (isOpen: boolean) => void;
  setGrimoireOpen: (isOpen: boolean) => void;
  setDevOverlayOpen: (isOpen: boolean) => void;
  
  // Complex Updates
  updateGameState: (updates: Partial<GameState>) => void;
  applyDirectorUpdates: (response: DirectorOutput) => void;
  
  // System
  resetGame: () => void;
  saveSnapshot: () => void;
  loadSnapshot: () => void;
  updateLogMedia: (logId: string, media: { imageData?: string, audioData?: string, videoData?: string }) => void;
}
