import { X, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsModal({ isOpen, onClose }) {
    const { theme, setTheme } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={onClose}>
            <div
                className="bg-[#1a1d21] light-theme:bg-white border border-gray-700 light-theme:border-gray-200 rounded-lg w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700 light-theme:border-gray-200">
                    <h2 className="text-xl font-bold text-white light-theme:text-gray-900">Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white light-theme:hover:text-gray-900 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                    {/* Theme Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            Appearance
                        </h3>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-300 light-theme:text-gray-700 mb-2 block">
                                Theme
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                        theme === 'dark'
                                            ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                            : 'border-gray-600 hover:border-gray-500 text-gray-300'
                                    }`}
                                >
                                    <Moon size={18} />
                                    <span className="font-medium">Dark</span>
                                </button>
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                        theme === 'light'
                                            ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                            : 'border-gray-600 hover:border-gray-500 text-gray-300'
                                    }`}
                                >
                                    <Sun size={18} />
                                    <span className="font-medium">Light</span>
                                </button>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-4 p-3 rounded-lg bg-[#2e3136] light-theme:bg-gray-100">
                            <div className="text-xs text-gray-500 mb-2">Preview</div>
                            <div
                                className={`p-3 rounded-lg transition-colors ${
                                    theme === 'dark'
                                        ? 'bg-[#1a1d21] text-white'
                                        : 'bg-white text-gray-900 border border-gray-200'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-8 h-8 rounded-full ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`} />
                                    <div>
                                        <div className="font-semibold text-sm">Username</div>
                                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                            12:00 PM
                                        </div>
                                    </div>
                                </div>
                                <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    This is how messages will look with the {theme} theme.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 light-theme:border-gray-200">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
