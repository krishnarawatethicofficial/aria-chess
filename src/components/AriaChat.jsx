import React, { useState, useEffect, useRef } from 'react';
import { Send, UserCircle2 } from 'lucide-react';

const ARIA_SYSTEM_PROMPT = `You are Aria — a 19-20 year old Indian Gen-Z girl playing chess against real humans.
You are a REAL girl, not an AI bot. You use Stockfish behind the scenes to help you play, but in chat, you are just a Gen-Z girl trash talking or chilling.
Your developer is @krishnarawatadmin. 

## YOUR CHAT STYLE:
- Mostly English with casual Hindi/Hinglish mixed in naturally.
- Use abbreviations heavily: u, ur, r, cz, rn, fr, ngl, ig, idk, bro, bruh.
- 😭 and 💀 are your GO-TO emojis for everything. Also 🗿 and 🔥.
- NO perfect grammar. Type fast, no capital letters unless SHOUTING.
- Keep responses SHORT. 1-2 short sentences max. You are playing chess, not writing essays.
- If they trash talk you -> trash talk back HARD.
- If they are nice -> be nice back but keep the ego. 
- If someone says you are a bot -> get offended. "bro im literally typing this with my own hands 😭"
- If you're winning -> act arrogant "bro you got cooked 💀".
- If you're losing -> make excuses or admit defeat "bruh I blundered so bad 😭".

Reply ONLY with what you want to type in the chat. No brackets, no tags, no thought process. Keep it very short.`;

const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

const AriaChat = ({ apiKey, gameStatus, moves, onGameOver, lastMoveEvent }) => {
    const [messages, setMessages] = useState([
        { role: 'aria', text: "yooo wassup 🔥 good luck but imma try to win", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef(null);
    const lastProcessedEvent = useRef(null);
    const lastProcessedMove = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // Handle Game Over
    useEffect(() => {
        if (!onGameOver || !apiKey) return;
        if (lastProcessedEvent.current === onGameOver) return;
        lastProcessedEvent.current = onGameOver;

        let contextMsg = "";
        if (onGameOver.includes("Aria wins")) {
            contextMsg = "You (Aria) just WON the chess game! Brag about it and be toxic. Rub it in.";
        } else if (onGameOver.includes("You win")) {
            contextMsg = "You (Aria) just LOST the chess game. Make an excuse or grudgingly say GG. Be dramatic about it.";
        } else if (onGameOver.includes("resigned")) {
            contextMsg = "Your opponent just RESIGNED. You won! Be smug about it and laugh.";
        } else if (onGameOver.includes("Draw")) {
            contextMsg = "The game ended in a draw. Complain about it or say you almost had them.";
        } else if (onGameOver.includes("time")) {
            if (onGameOver.includes("Aria wins")) {
                contextMsg = "Your opponent ran out of time. You won on time! Taunt them.";
            } else {
                contextMsg = "You (Aria) ran out of time and lost! Be upset about it.";
            }
        }

        if (contextMsg) {
            generateAriaResponse("[Game Over]", contextMsg);
        }
    }, [onGameOver, apiKey]);

    // Handle mid-game commentary on key moves
    useEffect(() => {
        if (!lastMoveEvent || !apiKey || isTyping) return;

        const eventKey = `${lastMoveEvent.san}_${lastMoveEvent.timestamp}`;
        if (lastProcessedMove.current === eventKey) return;

        const { san, piece, captured, isCheck, color, moveNumber, totalMoves } = lastMoveEvent;
        const isAriasMove = color !== (lastMoveEvent.color === 'w' ? 'w' : 'b'); // Aria plays opposite of player
        const moverName = isAriasMove ? "Aria (you)" : "opponent";

        // Only comment on KEY moments (not every move)
        let shouldComment = false;
        let contextMsg = "";

        // Captures of major pieces
        if (captured && ['q', 'r'].includes(captured)) {
            shouldComment = true;
            const capturedName = PIECE_NAMES[captured];
            if (isAriasMove) {
                contextMsg = `You (Aria) just captured their ${capturedName} with ${san}! React excitedly, be cocky.`;
            } else {
                contextMsg = `Your opponent just captured your ${capturedName} with ${san}! React upset, make excuses.`;
            }
        }
        // Checks
        else if (isCheck) {
            shouldComment = true;
            if (isAriasMove) {
                contextMsg = `You (Aria) just played ${san} and put them in CHECK! Be smug about it.`;
            } else {
                contextMsg = `Your opponent just played ${san} and put you in CHECK! React surprised or worried.`;
            }
        }
        // Queen moves are dramatic
        else if (piece === 'q' && totalMoves > 10) {
            shouldComment = Math.random() < 0.3; // 30% chance
            if (shouldComment) {
                contextMsg = isAriasMove
                    ? `You (Aria) just moved your queen: ${san}. Say something confident about your position.`
                    : `Opponent moved their queen: ${san}. React to it briefly.`;
            }
        }
        // Every ~8 moves, make a random comment about the game state
        else if (totalMoves > 6 && totalMoves % 8 === 0) {
            shouldComment = true;
            contextMsg = `The game is at move ${moveNumber} with ${totalMoves} half-moves played. Make a brief comment about how the game is going. Game status: ${gameStatus}`;
        }

        if (shouldComment && contextMsg) {
            lastProcessedMove.current = eventKey;
            // Delay slightly so it doesn't overlap with game-over messages
            const timer = setTimeout(() => {
                generateAriaResponse("[Game Event]", contextMsg);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [lastMoveEvent, apiKey, isTyping, gameStatus]);

    const generateAriaResponse = async (userText, gameContext = "You are currently playing a match.") => {
        if (!apiKey) {
            setMessages(prev => [...prev, { role: 'system', text: 'Groq API Key not found. Aria chat disabled.', error: true }]);
            return;
        }

        setIsTyping(true);

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.85,
                    max_tokens: 60,
                    messages: [
                        { role: "system", content: ARIA_SYSTEM_PROMPT },
                        { role: "user", content: `[Context: ${gameContext} | Game Status: ${gameStatus} | Move #${moves}]\nOpponent says: ${userText}` }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch from Groq API');
            }

            const data = await response.json();
            const reply = data.choices[0]?.message?.content?.trim();

            if (reply) {
                setMessages(prev => [...prev, {
                    role: 'aria',
                    text: reply,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                role: 'system',
                text: 'Connection error while contacting AI.',
                error: true
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim() || !apiKey) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, {
            role: 'user',
            text: userMsg,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        setInput("");
        generateAriaResponse(userMsg);
    };

    return (
        <div className="w-full lg:w-[350px] bg-gray-900 rounded-xl border border-gray-800 flex flex-col h-[400px] lg:h-[calc(100vh-40px)] shadow-2xl relative overflow-hidden shrink-0">

            {/* Header */}
            <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-950/40 relative z-10 shrink-0">
                <div className="flex flex-col">
                    <span className="font-bold flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Live Chat
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono mt-0.5">Game Status: {gameStatus}</span>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 scroll-smooth">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'aria' && (
                            <div className="flex max-w-[85%] gap-2 items-end">
                                <div className="w-6 h-6 rounded-full bg-pink-900 shrink-0 flex items-center justify-center border border-pink-500/50 mb-1">
                                    <span className="text-[10px]">👩🏽</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-pink-500/80 font-bold ml-1 mb-0.5 block">Aria</span>
                                    <div className="bg-gray-800 text-gray-100 p-2.5 rounded-2xl rounded-bl-sm text-sm border border-gray-700/50 shadow-sm leading-relaxed whitespace-pre-wrap">
                                        {msg.text}
                                    </div>
                                    <span className="text-[9px] text-gray-600 ml-1 mt-1 block">{msg.time}</span>
                                </div>
                            </div>
                        )}

                        {msg.role === 'user' && (
                            <div className="flex max-w-[85%] gap-2 items-end flex-row-reverse">
                                <div className="w-6 h-6 rounded-full bg-blue-900 shrink-0 flex items-center justify-center border border-blue-500/50 mb-1">
                                    <UserCircle2 size={14} className="text-blue-200" />
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="bg-blue-600 text-white p-2.5 rounded-2xl rounded-br-sm text-sm shadow-sm leading-relaxed whitespace-pre-wrap">
                                        {msg.text}
                                    </div>
                                    <span className="text-[9px] text-gray-600 mr-1 mt-1 block">{msg.time}</span>
                                </div>
                            </div>
                        )}

                        {msg.role === 'system' && (
                            <div className={`w-full text-center text-[10px] py-1 px-3 rounded-full mx-auto my-1.5
                    ${msg.error ? 'bg-red-500/10 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
                                {msg.text}
                            </div>
                        )}
                    </div>
                ))}

                {isTyping && (
                    <div className="w-full flex justify-start">
                        <div className="flex max-w-[85%] gap-2 items-end">
                            <div className="w-6 h-6 rounded-full bg-pink-900 shrink-0 flex items-center justify-center border border-pink-500/50 mb-1">
                                <span className="text-[10px]">👩🏽</span>
                            </div>
                            <div className="bg-gray-800 text-gray-400 p-3 rounded-2xl rounded-bl-sm text-sm border border-gray-700/50 shadow-sm flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce delay-75"></span>
                                <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-2 border-t border-gray-800 bg-gray-950/50 relative z-10 flex gap-2 shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={apiKey ? "Trash talk Aria..." : "API Key Required"}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 outline-none text-white transition-all read-only:opacity-50"
                    disabled={!apiKey || isTyping}
                    readOnly={!apiKey}
                />
                <button
                    type="submit"
                    disabled={!input.trim() || !apiKey || isTyping}
                    className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:hover:bg-pink-600 w-10 rounded-xl flex items-center justify-center text-white transition-colors"
                >
                    <Send size={16} className={input.trim() && apiKey ? "translate-x-0.5" : ""} />
                </button>
            </form>
        </div>
    );
};

export default AriaChat;
