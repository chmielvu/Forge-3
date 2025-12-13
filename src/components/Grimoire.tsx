import React, { useState, useRef } from 'react';
import { Camera, Film, Wand2, Upload, Loader2, Eye, X } from 'lucide-react';
import { analyzeArcaneRelic } from '../services/geminiService';
import { animateImageWithVeo, distortImage } from '../services/mediaService';
import { ToolMode, GameState } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onResult: (type: 'image' | 'video' | 'text', data: string, context: string) => void;
  gameState: GameState;
}

const Grimoire: React.FC<Props> = ({ isOpen, onClose, onResult, gameState }) => {
  const [mode, setMode] = useState<ToolMode>('ANALYZE');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const execute = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    const base64Raw = selectedFile.split(',')[1];

    try {
      if (mode === 'ANALYZE') {
        const result = await analyzeArcaneRelic(base64Raw, gameState);
        onResult('text', result, `RELIC_ANALYSIS`);
      } 
      else if (mode === 'REANIMATE') {
        const videoData = await animateImageWithVeo(base64Raw, prompt || "Make it breathe, subtle movement");
        if (videoData) onResult('video', videoData, `REANIMATED_MEMORY`);
      } 
      else if (mode === 'DISTORT') {
        const imageData = await distortImage(base64Raw, prompt || "Make it darker, corrupted");
        if (imageData) onResult('image', imageData, `DISTORTED_REALITY`);
      }
      onClose(); 
    } catch (e) {
      console.error("Grimoire Error", e);
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setPrompt('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-forge-black border border-forge-gold/30 shadow-[0_0_50px_rgba(250,204,21,0.1)] rounded-sm flex flex-col overflow-hidden relative animate-fade-in">
        
        {/* Header */}
        <div className="h-12 bg-stone-950 border-b border-stone-800 flex items-center justify-between px-4">
          <div className="font-display tracking-widest text-forge-gold uppercase flex items-center gap-2">
            <Eye size={16} className="text-forge-gold" />
            Faculty Terminal
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800">
          <button 
            onClick={() => setMode('ANALYZE')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors ${mode === 'ANALYZE' ? 'bg-stone-900 text-forge-gold border-b border-forge-gold' : 'text-stone-500'}`}
          >
            <Camera size={14} /> Analyze
          </button>
          <button 
            onClick={() => setMode('REANIMATE')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors ${mode === 'REANIMATE' ? 'bg-stone-900 text-forge-gold border-b border-forge-gold' : 'text-stone-500'}`}
          >
            <Film size={14} /> Reanimate (Veo)
          </button>
          <button 
            onClick={() => setMode('DISTORT')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors ${mode === 'DISTORT' ? 'bg-stone-900 text-forge-gold border-b border-forge-gold' : 'text-stone-500'}`}
          >
            <Wand2 size={14} /> Distort
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-black/50 flex-1 flex flex-col gap-6">
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-stone-800 hover:border-forge-gold/50 rounded-sm h-48 flex flex-col items-center justify-center cursor-pointer transition-colors relative group overflow-hidden"
          >
            {selectedFile ? (
              <img src={selectedFile} alt="Preview" className="w-full h-full object-contain p-2" />
            ) : (
              <>
                <Upload className="text-stone-700 group-hover:text-forge-gold mb-2 transition-colors" size={32} />
                <span className="text-xs font-mono text-stone-600 uppercase">Upload Evidence</span>
              </>
            )}
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileSelect} 
            />
          </div>

          {mode !== 'ANALYZE' && (
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-forge-subtle uppercase tracking-widest">Director Command</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === 'REANIMATE' ? "e.g., Make the shadows breathe, subtle cinematic pan..." : "e.g., Add a glitch effect, make it blood red..."}
                className="w-full bg-stone-900/50 border border-stone-800 rounded-sm p-3 text-sm text-forge-text focus:border-forge-gold outline-none font-serif resize-none h-20 placeholder:text-stone-700"
              />
            </div>
          )}

          <button 
            onClick={execute}
            disabled={!selectedFile || isProcessing}
            className={`w-full py-3 rounded-sm font-mono text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all
              ${!selectedFile || isProcessing ? 'bg-stone-900 text-stone-700 cursor-not-allowed' : 'bg-forge-gold hover:bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.2)]'}
            `}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Processing...
              </>
            ) : (
              <span>Execute Protocol</span>
            )}
          </button>

        </div>
      </div>
    </div>
  );
};

export default Grimoire;