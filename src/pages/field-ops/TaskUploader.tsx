import { useRef, useState } from 'react';
import { AlertCircle, Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { ApiError, api } from '../../lib/api';

interface ComplianceResult {
  passed: boolean;
  score: number;
  feedback: string;
  observations: string[];
}

interface TaskUploaderProps {
  taskId: string;
  onClose: () => void;
  onSuccess: (result: ComplianceResult) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Field evidence upload.
 *
 * The previous version simulated everything: a `setTimeout` stood in for the
 * upload, the request body carried the literal string
 * 'base64-encoded-image-data', and a failed call reported
 * `onSuccess(50, 'Failed to connect to AI engine')` - i.e. a compliance score
 * for a photo that was never sent and never looked at.
 */
export default function TaskUploader({ taskId, onClose, onSuccess }: TaskUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  function handleSelect(selected: File | undefined) {
    if (!selected) return;

    if (!ACCEPTED.includes(selected.type)) {
      setError('Please choose a PNG, JPEG or WebP image.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('That image is over 5 MB. Please use a smaller photo.');
      return;
    }

    setError('');
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setError('Could not read that file. Please try another.');
    reader.readAsDataURL(selected);
  }

  async function handleSubmit() {
    if (!preview) {
      setError('Select a photo first.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const result = await api.post<ComplianceResult>('/ai/visual-compliance', {
        taskId,
        image: preview,
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      // No invented score. If the inspection did not happen, the task stays
      // unverified and the agent is told why.
      if (err instanceof ApiError) {
        setError(
          err.status === 503
            ? 'Image analysis is unavailable right now. Your photo was not submitted - please try again shortly.'
            : err.message
        );
      } else {
        setError('Could not submit the photo. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600">
          <h2 className="text-lg font-bold text-white">Visual compliance check</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center gap-4">
          {preview ? (
            <img
              src={preview}
              alt="Selected field evidence"
              className="max-h-52 w-auto rounded-xl border border-slate-200 object-contain"
            />
          ) : (
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
              <ImageIcon size={36} />
            </div>
          )}

          <p className="text-sm text-slate-500 max-w-[300px]">
            Upload a clear photo of the completed execution. It is analysed against the
            campaign rules before the task is marked complete.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            capture="environment"
            className="hidden"
            onChange={(e) => handleSelect(e.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all cursor-pointer flex flex-col items-center gap-2"
          >
            <Upload className="text-purple-400" size={26} />
            <span className="text-sm font-medium text-slate-600">
              {file ? `Change photo (${file.name})` : 'Tap to take or select a photo'}
            </span>
          </button>

          {error && (
            <div
              role="alert"
              className="w-full flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-left"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-red-600 text-sm">{error}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!preview || isAnalyzing}
            className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 min-w-[170px] justify-center transition-all"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Analysing photo...
              </>
            ) : (
              'Submit for review'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
