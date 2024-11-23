import React from "react";
import { Send, Loader2 } from "lucide-react";

interface PromptPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

const PromptPopup: React.FC<PromptPopupProps> = ({
  isOpen,
  onSubmit,
  isLoading = false,
  error,
}) => {
  const [prompt, setPrompt] = React.useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt);
    setPrompt("");
  };

  return (
    <div
      className="fixed bottom-20 right-4 z-[9999] w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="p-2">
        {error && (
          <div className="mb-2 rounded-md bg-red-100 p-2 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-gray-700 dark:text-white"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Please enter your request"
            autoFocus
            disabled={isLoading}
          />
          <button
            type="submit"
            className="rounded-md bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PromptPopup;
