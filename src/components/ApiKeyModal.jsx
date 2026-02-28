import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Check } from 'lucide-react';

const ApiKeyModal = ({ onSave }) => {
    const [apiKey, setApiKey] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const savedKey = localStorage.getItem('GROQ_API_KEY');
        if (!savedKey) {
            setIsOpen(true);
        } else {
            onSave(savedKey);
        }
    }, [onSave]);

    const handleSave = () => {
        if (apiKey.trim().startsWith('gsk_')) {
            localStorage.setItem('GROQ_API_KEY', apiKey.trim());
            onSave(apiKey.trim());
            setIsOpen(false);
        } else {
            alert("Invalid Groq API Key format. It should start with 'gsk_'");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-orange-400"></div>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-pink-500/10 text-pink-500 rounded-xl">
                        <KeyRound size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Groq API Key Required</h2>
                        <p className="text-xs text-gray-400">To enable Aria's AI Chat</p>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Enter your Groq API Key
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="gsk_..."
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 outline-none transition-all placeholder:text-gray-600"
                    />
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6 flex gap-3 text-orange-200">
                    <ShieldAlert size={20} className="shrink-0 mt-0.5 text-orange-400" />
                    <p className="text-xs leading-relaxed">
                        <strong>Privacy Note:</strong> Your key is stored locally in your browser and never sent to our servers. It is only sent directly to Groq.com for generating chat messages.
                    </p>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        Play without Chat
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 rounded-lg text-sm font-bold bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/30 transition-all flex items-center gap-2"
                    >
                        <Check size={16} /> Save Key
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
