import React, { useState } from 'react';
import { Upload, X, Check, Loader2, Image as ImageIcon } from 'lucide-react';

interface TaskUploaderProps {
  taskId: string;
  onClose: () => void;
  onSuccess: (score: number, feedback: string) => void;
}

export default function TaskUploader({ taskId, onClose, onSuccess }: TaskUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSimulateUpload = async () => {
    setIsUploading(true);
    
    // Simulate upload delay for UI feedback
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsUploading(false);
    
    setIsAnalyzing(true);
    try {
      const res = await fetch('http://localhost:3001/api/ai/visual-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: 'base64-encoded-image-data', // Simulated image upload
          campaignRules: 'Must show the brand logo clearly.'
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        onSuccess(Math.round(data.score * 100), data.feedback);
      } else {
        onSuccess(50, 'Failed to connect to AI engine');
      }
    } catch (err) {
      onSuccess(0, 'Network error during AI analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <SparklesIcon /> Gemini Vision AI
          </h2>
          <button onClick={onClose} className="p-1 text-white/80 hover:bg-white/20 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-50 to-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
            <ImageIcon size={40} className="text-blue-500" />
          </div>
          
          <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700">
            Upload Visual Proof
          </h3>
          <p className="text-sm text-gray-500 max-w-[280px]">
            Please upload a clear photo of the completed execution. Gemini AI will automatically verify your compliance.
          </p>

          <div className="w-full mt-4 p-8 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 hover:shadow-md transition-all duration-300 cursor-pointer group flex flex-col items-center">
            <Upload className="text-purple-300 group-hover:text-purple-600 mb-3 transition-colors" size={28} />
            <span className="text-sm font-medium text-gray-600 group-hover:text-purple-700">Tap to select photo or drag here</span>
          </div>
        </div>

        {/* Footer / Status */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg mr-3 transition-colors">
            Cancel
          </button>
          
          <button 
            onClick={handleSimulateUpload}
            disabled={isUploading || isAnalyzing}
            className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg shadow-md hover:shadow-lg disabled:opacity-70 flex items-center gap-2 min-w-[160px] justify-center transition-all duration-200"
          >
            {isUploading && <><Loader2 size={16} className="animate-spin" /> Uploading...</>}
            {isAnalyzing && <><Loader2 size={16} className="animate-spin" /> Gemini is analyzing...</>}
            {!isUploading && !isAnalyzing && 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
      <path d="M20 3v4"/>
      <path d="M22 5h-4"/>
      <path d="M4 17v2"/>
      <path d="M5 18H3"/>
    </svg>
  );
}
