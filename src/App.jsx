import React, { useState } from 'react';
import { Settings, Github } from 'lucide-react';
import ChessGame from './components/ChessGame';
import AriaChat from './components/AriaChat';

function App() {
    const [apiKey, setApiKey] = useState('');
    const [gameStatus, setGameStatus] = useState("Waiting to start");
    const [moves, setMoves] = useState(0);
    const [gameOverEvent, setGameOverEvent] = useState(null);

    const handleGameUpdate = (status, moveCount, gameOverString) => {
        setGameStatus(status);
        setMoves(moveCount);
        if (gameOverString) {
            setGameOverEvent(gameOverString);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-start lg:justify-center p-2 lg:p-4 bg-gray-950 font-sans selection:bg-pink-500/30 overflow-y-auto overflow-x-hidden lg:overflow-hidden lg:h-screen">
            <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-3 lg:gap-4 justify-center items-center lg:h-full py-2 lg:py-0">
                <ChessGame onGameUpdate={handleGameUpdate} />

                <AriaChat
                    apiKey={apiKey}
                    gameStatus={gameStatus}
                    moves={moves}
                    onGameOver={gameOverEvent}
                />
            </main>
        </div>
    );
}

export default App;
