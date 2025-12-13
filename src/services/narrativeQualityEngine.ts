
import { YandereLedger, GameState } from '../types';

export interface QualityMetrics {
  wordCount: number;
  hasDialogue: boolean;
  hasAction: boolean;
  hasEnvironmentalDetail: boolean;
  hasSomaticDetail: boolean;
  hasEmotionalDepth: boolean;
  tensionLevel: number; // 0-1
  pacing: 'rushed' | 'balanced' | 'languid';
  coherenceScore: number; // 0-1
}

export interface NarrativeIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'length' | 'pacing' | 'coherence' | 'detail' | 'tone';
  message: string;
  autoFixable: boolean;
}

export class NarrativeQualityEngine {
  private minWordCount = 300;
  private maxWordCount = 600;
  private previousNarratives: string[] = [];
  
  /**
   * Analyzes narrative quality and identifies issues
   */
  analyzeNarrative(narrative: string, ledger: YandereLedger): {
    metrics: QualityMetrics;
    issues: NarrativeIssue[];
    passesQuality: boolean;
  } {
    const metrics = this.calculateMetrics(narrative, ledger);
    const issues = this.identifyIssues(narrative, metrics, ledger);
    const passesQuality = this.evaluateQuality(metrics, issues);
    
    return { metrics, issues, passesQuality };
  }

  private calculateMetrics(narrative: string, ledger: YandereLedger): QualityMetrics {
    const wordCount = narrative.split(/\s+/).length;
    
    // Check for key narrative elements
    const hasDialogue = /"[^"]+"|'[^']+'/.test(narrative) || 
                        /says|whispers|commands|murmurs|growls/i.test(narrative);
    
    const hasAction = /reaches|grabs|walks|kneels|strikes|touches|moves/i.test(narrative);
    
    const hasEnvironmentalDetail = 
      /stone|light|shadow|smell|sound|temperature|walls|ceiling|floor/i.test(narrative);
    
    const hasSomaticDetail = 
      /skin|sweat|pulse|breathing|tremb|shiv|ache|pain|warmth|cold/i.test(narrative);
    
    const hasEmotionalDepth = 
      /fear|shame|desire|hope|despair|terror|anticipation|humiliation/i.test(narrative);
    
    // Calculate tension based on content and ledger
    const tensionLevel = this.calculateTension(narrative, ledger);
    
    // Determine pacing
    const avgSentenceLength = this.getAverageSentenceLength(narrative);
    const pacing = avgSentenceLength < 15 ? 'rushed' : 
                   avgSentenceLength > 25 ? 'languid' : 'balanced';
    
    // Check coherence with previous narratives
    const coherenceScore = this.calculateCoherence(narrative);
    
    return {
      wordCount,
      hasDialogue,
      hasAction,
      hasEnvironmentalDetail,
      hasSomaticDetail,
      hasEmotionalDepth,
      tensionLevel,
      pacing,
      coherenceScore
    };
  }

  private calculateTension(narrative: string, ledger: YandereLedger): number {
    let tension = 0;
    
    // Base tension from ledger
    tension += ledger.traumaLevel / 200;
    tension += ledger.shamePainAbyssLevel / 200;
    tension += (100 - ledger.hopeLevel) / 200;
    
    // Tension markers in text
    const tensionWords = [
      'suddenly', 'abruptly', 'violently', 'sharply', 'harsh', 'cold',
      'silence', 'scream', 'cry', 'breaking', 'shattering', 'crushing'
    ];
    
    tensionWords.forEach(word => {
      if (new RegExp(word, 'i').test(narrative)) {
        tension += 0.05;
      }
    });
    
    return Math.min(1, tension);
  }

  private getAverageSentenceLength(narrative: string): number {
    const sentences = narrative.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    const totalWords = sentences.reduce((sum, sentence) => {
      return sum + sentence.split(/\s+/).length;
    }, 0);
    
    return totalWords / sentences.length;
  }

  private calculateCoherence(narrative: string): number {
    if (this.previousNarratives.length === 0) return 1;
    
    // Check for contradictions or sudden shifts
    const lastNarrative = this.previousNarratives[this.previousNarratives.length - 1];
    
    // Extract key elements (locations, characters, tone)
    const currentElements = this.extractNarrativeElements(narrative);
    const previousElements = this.extractNarrativeElements(lastNarrative);
    
    // Calculate overlap and logical progression
    let coherenceScore = 0.5; // baseline
    
    // Location continuity
    if (currentElements.location === previousElements.location) {
      coherenceScore += 0.2;
    } else if (currentElements.location && previousElements.location) {
      // Check if transition was mentioned
      if (/walk|move|lead|enter|leave|arrive/i.test(narrative)) {
        coherenceScore += 0.1; // Explained transition
      }
    }
    
    // Character continuity
    const characterOverlap = currentElements.characters.filter(c => 
      previousElements.characters.includes(c)
    ).length;
    coherenceScore += (characterOverlap / Math.max(1, previousElements.characters.length)) * 0.2;
    
    // Tone progression (should be gradual, not sudden)
    const toneDifference = Math.abs(currentElements.toneIntensity - previousElements.toneIntensity);
    if (toneDifference < 0.3) {
      coherenceScore += 0.1;
    }
    
    return Math.min(1, coherenceScore);
  }

  private extractNarrativeElements(narrative: string): {
    location: string | null;
    characters: string[];
    toneIntensity: number;
  } {
    const lower = narrative.toLowerCase();
    
    // Extract location
    let location: string | null = null;
    const locationMatches = lower.match(/(?:in|at|inside|within) (?:the )?([a-z ]+?)(?:,|\.|you|she|he)/i);
    if (locationMatches) {
      location = locationMatches[1].trim();
    }
    
    // Extract characters
    const characters: string[] = [];
    const characterNames = [
      'selene', 'lysandra', 'petra', 'calista', 'mara', 'anya',
      'kaelen', 'elara', 'rhea', 'provost', 'doctor', 'inquisitor'
    ];
    characterNames.forEach(name => {
      if (lower.includes(name)) characters.push(name);
    });
    
    // Calculate tone intensity
    const intensityWords = ['screams', 'violently', 'crushing', 'breaking', 'shattering'];
    const gentleWords = ['softly', 'gently', 'whispers', 'caresses', 'soothes'];
    
    let toneIntensity = 0.5;
    intensityWords.forEach(word => {
      if (lower.includes(word)) toneIntensity += 0.1;
    });
    gentleWords.forEach(word => {
      if (lower.includes(word)) toneIntensity -= 0.1;
    });
    
    return {
      location,
      characters,
      toneIntensity: Math.max(0, Math.min(1, toneIntensity))
    };
  }

  private identifyIssues(
    narrative: string,
    metrics: QualityMetrics,
    ledger: YandereLedger
  ): NarrativeIssue[] {
    const issues: NarrativeIssue[] = [];
    
    // CRITICAL: Length requirements
    if (metrics.wordCount < this.minWordCount) {
      issues.push({
        severity: 'critical',
        category: 'length',
        message: `Narrative too short (${metrics.wordCount} words, minimum ${this.minWordCount})`,
        autoFixable: true
      });
    }
    
    if (metrics.wordCount > this.maxWordCount) {
      issues.push({
        severity: 'warning',
        category: 'length',
        message: `Narrative too long (${metrics.wordCount} words, maximum ${this.maxWordCount})`,
        autoFixable: true
      });
    }
    
    // WARNING: Missing key elements
    if (!metrics.hasEnvironmentalDetail) {
      issues.push({
        severity: 'warning',
        category: 'detail',
        message: 'Missing environmental detail (lighting, atmosphere, setting)',
        autoFixable: false
      });
    }
    
    if (!metrics.hasSomaticDetail && ledger.traumaLevel > 50) {
      issues.push({
        severity: 'warning',
        category: 'detail',
        message: 'High trauma but missing somatic/physical detail',
        autoFixable: false
      });
    }
    
    if (!metrics.hasEmotionalDepth) {
      issues.push({
        severity: 'warning',
        category: 'detail',
        message: 'Narrative lacks emotional depth',
        autoFixable: false
      });
    }
    
    // SUGGESTION: Pacing issues
    if (metrics.pacing === 'rushed') {
      issues.push({
        severity: 'suggestion',
        category: 'pacing',
        message: 'Pacing feels rushed; consider longer, more descriptive sentences',
        autoFixable: false
      });
    }
    
    // WARNING: Coherence issues
    if (metrics.coherenceScore < 0.5) {
      issues.push({
        severity: 'warning',
        category: 'coherence',
        message: 'Narrative may lack continuity with previous turn',
        autoFixable: false
      });
    }
    
    return issues;
  }

  private evaluateQuality(metrics: QualityMetrics, issues: NarrativeIssue[]): boolean {
    // Fail if any critical issues
    if (issues.some(i => i.severity === 'critical')) {
      return false;
    }
    
    // Fail if too many warnings
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    if (warningCount > 3) {
      return false;
    }
    
    // Pass if minimum requirements met
    return metrics.wordCount >= this.minWordCount &&
           metrics.coherenceScore >= 0.4;
  }

  /**
   * Attempts to automatically fix issues
   */
  autoFixNarrative(
    narrative: string,
    issues: NarrativeIssue[],
    context: GameState
  ): string {
    let fixedNarrative = narrative;
    
    for (const issue of issues) {
      if (!issue.autoFixable) continue;
      
      if (issue.category === 'length' && issue.message.includes('too short')) {
        // Add environmental expansion
        fixedNarrative = this.expandNarrative(fixedNarrative, context);
      }
      
      if (issue.category === 'length' && issue.message.includes('too long')) {
        // Trim verbose sections
        fixedNarrative = this.trimNarrative(fixedNarrative);
      }
    }
    
    return fixedNarrative;
  }

  private expandNarrative(narrative: string, context: GameState): string {
    // Add atmospheric details based on location and ledger
    const ledger = context.ledger;
    
    const atmosphericDetails = [
      'The air is thick with humidity, each breath tasting of copper and ash.',
      'Shadows pool in the corners, shifting with the flickering torchlight.',
      'The stone walls weep condensation, cold and slick to the touch.',
      'A distant rhythmic pounding echoes through the corridors—the magma hammers, never ceasing.',
      'Your pulse throbs in your temples, a counterpoint to the oppressive silence.'
    ];
    
    // Select appropriate detail based on trauma level
    const detail = atmosphericDetails[Math.min(atmosphericDetails.length - 1, Math.floor(ledger.traumaLevel / 20))];
    
    // Insert after first sentence
    const sentences = narrative.split(/(?<=[.!?])\s+/);
    if (sentences.length > 0) {
      sentences.splice(1, 0, detail);
    }
    
    return sentences.join(' ');
  }

  private trimNarrative(narrative: string): string {
    // Remove redundant modifiers and tighten prose
    let trimmed = narrative;
    
    // Remove excessive adjectives (more than 2 in a row)
    trimmed = trimmed.replace(/(\w+ly\s+){3,}/g, (match) => {
      const words = match.trim().split(/\s+/);
      return words.slice(0, 2).join(' ') + ' ';
    });
    
    // Remove filler phrases
    const fillerPhrases = [
      'it seems that', 'it appears that', 'one might say', 
      'in a manner of speaking', 'so to speak'
    ];
    fillerPhrases.forEach(phrase => {
      trimmed = trimmed.replace(new RegExp(phrase, 'gi'), '');
    });
    
    return trimmed.trim();
  }

  /**
   * Record narrative for coherence tracking
   */
  recordNarrative(narrative: string): void {
    this.previousNarratives.push(narrative);
    
    // Keep only last 5 for memory efficiency
    if (this.previousNarratives.length > 5) {
      this.previousNarratives = this.previousNarratives.slice(-5);
    }
  }

  /**
   * Generate improvement suggestions for Director
   */
  generateImprovementPrompt(issues: NarrativeIssue[]): string {
    if (issues.length === 0) return '';
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const warningIssues = issues.filter(i => i.severity === 'warning');
    
    let prompt = '\n\nNARRATIVE QUALITY FEEDBACK:\n';
    
    if (criticalIssues.length > 0) {
      prompt += 'CRITICAL ISSUES:\n';
      criticalIssues.forEach(issue => {
        prompt += `- ${issue.message}\n`;
      });
    }
    
    if (warningIssues.length > 0) {
      prompt += '\nIMPROVEMENT SUGGESTIONS:\n';
      warningIssues.forEach(issue => {
        prompt += `- ${issue.message}\n`;
      });
    }
    
    return prompt;
  }

  reset(): void {
    this.previousNarratives = [];
  }
}

export const narrativeQualityEngine = new NarrativeQualityEngine();
