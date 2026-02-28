import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Play } from 'lucide-react';

const TIME_CONTROLS = {
    bullet: { label: 'Bullet (1m)', time: 60 },
    blitz: { label: 'Blitz (3m)', time: 180 },
    rapid: { label: 'Rapid (10m)', time: 600 },
    classic: { label: 'Classic (30m)', time: 1800 }
};

const PLAY_SIDES = {
    white: { label: 'White', color: 'w' },
    black: { label: 'Black', color: 'b' },
    random: { label: 'Random', color: 'random' }
};

const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

const getPieceAt = (game, sq) => {
    const c = sq.charCodeAt(0) - 97, r = 8 - parseInt(sq[1]);
    const b = game.board();
    return b[r] && b[r][c] ? b[r][c] : null;
};

const findKingSquare = (game, color) => {
    const b = game.board();
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && p.type === 'k' && p.color === color)
                return `${String.fromCharCode(97 + c)}${8 - r}`;
        }
    return null;
};

const sqToCoords = (sq, orient) => {
    const f = sq.charCodeAt(0) - 97, rk = parseInt(sq[1]) - 1;
    return orient === 'white' ? { col: f, row: 7 - rk } : { col: 7 - f, row: rk };
};

const coordsToSq = (col, row, orient) => {
    const [f, rk] = orient === 'white' ? [col, 7 - row] : [7 - col, row];
    return `${String.fromCharCode(97 + f)}${rk + 1}`;
};

const ChessGame = ({ onGameUpdate }) => {
    const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const [engineReady, setEngineReady] = useState(false);
    const [status, setStatus] = useState("Select Time & Start");
    const [gameStarted, setGameStarted] = useState(false);
    const [timeControl, setTimeControl] = useState('rapid');
    const [playSideSetting, setPlaySideSetting] = useState('white');
    const [playerColor, setPlayerColor] = useState('w');
    const [playerTime, setPlayerTime] = useState(TIME_CONTROLS.rapid.time);
    const [ariaTime, setAriaTime] = useState(TIME_CONTROLS.rapid.time);
    const [timerActive, setTimerActive] = useState(false);

    // Click-to-move state
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [legalMoves, setLegalMoves] = useState([]);

    // Premove state
    const [premove, setPremove] = useState(null);

    const engineRef = useRef(null);
    const timerRef = useRef(null);
    const gameRef = useRef(new Chess());
    const playerColorRef = useRef('w');
    const gameStartedRef = useRef(false);
    const boardRef = useRef(null);

    // Pointer tracking for distinguishing click vs drag
    const pointerDownPos = useRef(null);
    const pointerDownTime = useRef(0);

    useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);
    useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);

    const syncFen = useCallback(() => setFen(gameRef.current.fen()), []);
    const clearSel = useCallback(() => { setSelectedSquare(null); setLegalMoves([]); }, []);
    const clearPremove = useCallback(() => setPremove(null), []);

    const selectPiece = useCallback((sq) => {
        const moves = gameRef.current.moves({ square: sq, verbose: true });
        if (moves.length > 0) { setSelectedSquare(sq); setLegalMoves(moves); }
        else { clearSel(); }
    }, [clearSel]);

    // Get square from pointer event coordinates
    const getSquareFromEvent = useCallback((e) => {
        const el = boardRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        // Account for the border (3px)
        const borderWidth = 3;
        const boardLeft = rect.left + borderWidth;
        const boardTop = rect.top + borderWidth;
        const boardSize = rect.width - borderWidth * 2;
        const sqSize = boardSize / 8;
        const x = e.clientX - boardLeft;
        const y = e.clientY - boardTop;
        const col = Math.floor(x / sqSize);
        const row = Math.floor(y / sqSize);
        if (col < 0 || col > 7 || row < 0 || row > 7) return null;
        const orient = playerColorRef.current === 'w' ? 'white' : 'black';
        return coordsToSq(col, row, orient);
    }, []);

    // Helper: get last move info for chat context
    const getLastMoveInfo = useCallback(() => {
        const hist = gameRef.current.history({ verbose: true });
        if (hist.length === 0) return null;
        const last = hist[hist.length - 1];
        return {
            san: last.san,
            piece: last.piece,
            captured: last.captured || null,
            isCheck: last.san.includes('+'),
            isCheckmate: last.san.includes('#'),
            color: last.color,
            playerColor: playerColorRef.current,
            moveNumber: Math.ceil(hist.length / 2),
            totalMoves: hist.length,
        };
    }, []);

    // Helper: format game-over message with You/Aria instead of White/Black
    const getGameOverMsg = useCallback(() => {
        if (gameRef.current.isCheckmate()) {
            const loserTurn = gameRef.current.turn(); // the side that is checkmated
            const ariaWins = loserTurn === playerColorRef.current;
            return ariaWins ? 'Game over! Aria wins by checkmate!' : 'Game over! You win by checkmate!';
        }
        if (gameRef.current.isDraw()) return 'Game over! Draw.';
        return 'Game over!';
    }, []);

    // Engine initialization
    useEffect(() => {
        const worker = new Worker('/stockfish.js');
        engineRef.current = worker;
        worker.onmessage = (event) => {
            const line = event.data;
            if (line === 'uciok') setEngineReady(true);
            else if (typeof line === 'string' && line.startsWith('bestmove')) {
                const moveStr = line.split(' ')[1];
                if (moveStr && moveStr !== '(none)') {
                    try {
                        const mo = { from: moveStr.substring(0, 2), to: moveStr.substring(2, 4) };
                        if (moveStr.length > 4) mo.promotion = moveStr[4];
                        gameRef.current.move(mo);
                        syncFen();
                        clearSel();
                        const moveInfo = getLastMoveInfo();
                        if (gameRef.current.isGameOver()) {
                            const msg = getGameOverMsg();
                            setStatus(msg); setTimerActive(false); setGameStarted(false);
                            if (onGameUpdate) onGameUpdate("Game over!", gameRef.current.history().length, msg, moveInfo);
                        } else {
                            setStatus("Your turn.");
                            if (onGameUpdate) onGameUpdate("Your turn.", gameRef.current.history().length, null, moveInfo);
                        }
                    } catch (e) { console.error("Engine move error:", moveStr, e.message); }
                }
            }
        };
        worker.postMessage('uci');
        worker.postMessage('isready');
        return () => { worker.terminate(); if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // Execute premove when it becomes player's turn
    useEffect(() => {
        if (!premove || !gameStartedRef.current) return;
        if (gameRef.current.turn() !== playerColorRef.current) return;

        const timer = setTimeout(() => {
            const { from, to } = premove;
            setPremove(null);
            try {
                const mo = { from, to };
                const piece = getPieceAt(gameRef.current, from);
                if (piece && piece.type === 'p') {
                    if ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))
                        mo.promotion = 'q';
                }
                gameRef.current.move(mo);
                syncFen(); clearSel();
                const moveInfo = getLastMoveInfo();
                if (gameRef.current.isGameOver()) {
                    const msg = getGameOverMsg();
                    setStatus(msg); setTimerActive(false); setGameStarted(false);
                    if (onGameUpdate) onGameUpdate("Game over!", gameRef.current.history().length, msg, moveInfo);
                } else {
                    requestEngineMove();
                    if (onGameUpdate) onGameUpdate("Aria is thinking...", gameRef.current.history().length, null, moveInfo);
                }
            } catch (e) { console.log("Premove illegal:", from, to, e.message); }
        }, 120);
        return () => clearTimeout(timer);
    }, [fen, premove]);

    // Timer
    useEffect(() => {
        if (!timerActive || !gameStarted) { if (timerRef.current) clearInterval(timerRef.current); return; }
        timerRef.current = setInterval(() => {
            const turn = gameRef.current.turn();
            const setter = turn === playerColorRef.current ? setPlayerTime : setAriaTime;
            setter(prev => {
                if (prev - 1 <= 0) {
                    clearInterval(timerRef.current); setTimerActive(false); setGameStarted(false);
                    const youLost = turn === playerColorRef.current;
                    const msg = youLost ? 'Game over! Aria wins on time!' : 'Game over! You win on time!';
                    setStatus(msg);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timerActive, gameStarted]);

    const requestEngineMove = useCallback(() => {
        setStatus("Aria is thinking...");
        engineRef.current.postMessage(`position fen ${gameRef.current.fen()}`);
        engineRef.current.postMessage('go movetime 1000');
    }, []);

    const startGame = () => {
        if (!engineReady) return;
        const g = new Chess(); gameRef.current = g;
        const t = TIME_CONTROLS[timeControl].time; setPlayerTime(t); setAriaTime(t);
        let c = 'w';
        if (playSideSetting === 'random') c = Math.random() < 0.5 ? 'w' : 'b';
        else c = PLAY_SIDES[playSideSetting].color;
        setPlayerColor(c); playerColorRef.current = c;
        setGameStarted(true); gameStartedRef.current = true; setTimerActive(true);
        clearSel(); clearPremove(); syncFen();
        if (c === 'b') { setStatus("Aria is thinking..."); if (onGameUpdate) onGameUpdate("Aria is thinking...", 0, null); requestEngineMove(); }
        else { setStatus("Your turn."); if (onGameUpdate) onGameUpdate("Your turn.", 0, null); }
    };

    const executeMove = useCallback((from, to) => {
        try {
            const mo = { from, to };
            const p = getPieceAt(gameRef.current, from);
            if (p && p.type === 'p') {
                if ((p.color === 'w' && to[1] === '8') || (p.color === 'b' && to[1] === '1')) mo.promotion = 'q';
            }
            gameRef.current.move(mo); syncFen(); clearSel(); clearPremove();
            const moveInfo = getLastMoveInfo();
            if (gameRef.current.isGameOver()) {
                const msg = getGameOverMsg();
                setStatus(msg); setTimerActive(false); setGameStarted(false);
                if (onGameUpdate) onGameUpdate("Game over!", gameRef.current.history().length, msg, moveInfo);
            } else {
                requestEngineMove();
                if (onGameUpdate) onGameUpdate("Aria is thinking...", gameRef.current.history().length, null, moveInfo);
            }
            return true;
        } catch (e) { console.log("Invalid:", from, to, e.message); return false; }
    }, [syncFen, clearSel, clearPremove, requestEngineMove, onGameUpdate, getLastMoveInfo, getGameOverMsg]);

    // Drag-drop
    const handlePieceDrop = useCallback(({ piece, sourceSquare, targetSquare }) => {
        if (!gameStartedRef.current) return false;
        clearSel();
        if (gameRef.current.turn() !== playerColorRef.current) {
            setPremove({ from: sourceSquare, to: targetSquare });
            return false;
        }
        return executeMove(sourceSquare, targetSquare);
    }, [executeMove, clearSel]);

    // ═══════════════════════════════════════════════════════════
    // CAPTURE-PHASE POINTER EVENTS for click-to-move
    // These fire BEFORE @dnd-kit can swallow the events
    // ═══════════════════════════════════════════════════════════
    const handlePointerDown = useCallback((e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        pointerDownTime.current = Date.now();
    }, []);

    const handlePointerUp = useCallback((e) => {
        if (!pointerDownPos.current) return;
        if (!gameStartedRef.current) return;

        const dx = Math.abs(e.clientX - pointerDownPos.current.x);
        const dy = Math.abs(e.clientY - pointerDownPos.current.y);
        const dt = Date.now() - pointerDownTime.current;
        pointerDownPos.current = null;

        // If pointer moved more than 8px or held longer than 500ms, it's a drag — ignore
        if (dx > 8 || dy > 8 || dt > 500) return;

        // It's a tap/click
        const square = getSquareFromEvent(e);
        if (!square) return;

        const isPlayerTurn = gameRef.current.turn() === playerColorRef.current;
        const piece = getPieceAt(gameRef.current, square);

        if (isPlayerTurn) {
            // If we have a selected piece
            if (selectedSquare) {
                // Is this square a legal target?
                const isLegal = legalMoves.some(m => m.to === square);
                if (isLegal) {
                    executeMove(selectedSquare, square);
                    return;
                }
                // Click same square: deselect
                if (selectedSquare === square) { clearSel(); return; }
                // Click own piece: switch
                if (piece && piece.color === playerColorRef.current) { selectPiece(square); return; }
                // Other: deselect
                clearSel();
                return;
            }
            // Nothing selected: click own piece to select
            if (piece && piece.color === playerColorRef.current) selectPiece(square);
        } else {
            // Opponent's turn → premove logic
            if (selectedSquare) {
                if (selectedSquare !== square) {
                    setPremove({ from: selectedSquare, to: square });
                    clearSel();
                } else {
                    clearSel(); clearPremove();
                }
                return;
            }
            if (piece && piece.color === playerColorRef.current) {
                clearPremove();
                // For premove, show all pseudo-legal moves (use the piece's current square)
                setSelectedSquare(square);
                // Generate all possible destinations for this piece type (simplified)
                const allSquares = [];
                for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) {
                    allSquares.push(`${String.fromCharCode(97 + f)}${r}`);
                }
                setLegalMoves(allSquares.filter(s => s !== square).map(s => ({ to: s, flags: '' })));
            } else {
                clearPremove(); clearSel();
            }
        }
    }, [selectedSquare, legalMoves, executeMove, clearSel, selectPiece, clearPremove, getSquareFromEvent]);

    const resignGame = () => {
        if (!gameStartedRef.current) return;
        setTimerActive(false); setGameStarted(false); clearSel(); clearPremove();
        const msg = 'Game over! You resigned. Aria wins!';
        setStatus(msg);
        if (onGameUpdate) onGameUpdate("Game over!", gameRef.current.history().length, msg, null);
    };

    const orient = playerColor === 'w' ? 'white' : 'black';
    const turn = fen === 'start' ? 'w' : (fen.split(' ')[1] || 'w');

    const boardOptions = useMemo(() => ({
        position: fen,
        onPieceDrop: handlePieceDrop,
        boardOrientation: orient,
        darkSquareStyle: { backgroundColor: '#779556' },
        lightSquareStyle: { backgroundColor: '#ebecd0' },
        allowDragging: gameStarted,
    }), [fen, handlePieceDrop, orient, gameStarted]);

    // Build visual overlay
    const overlays = useMemo(() => {
        const items = [];
        const game = gameRef.current;

        // Last move highlight (subtle green tint on from/to squares)
        const history = game.history({ verbose: true });
        if (history.length > 0) {
            const last = history[history.length - 1];
            [last.from, last.to].forEach((sq, i) => {
                const { col, row } = sqToCoords(sq, orient);
                items.push(<div key={`last-${i}`} style={{
                    position: 'absolute', left: `${col * 12.5}%`, top: `${row * 12.5}%`,
                    width: '12.5%', height: '12.5%', backgroundColor: 'rgba(255,255,50,0.18)',
                    pointerEvents: 'none', zIndex: 1,
                }} />);
            });
        }

        // Check glow — inset box-shadow so center stays transparent (king piece visible)
        if (game.isCheck && game.isCheck()) {
            const kingSq = findKingSquare(game, game.turn());
            if (kingSq) {
                const { col, row } = sqToCoords(kingSq, orient);
                const isMate = game.isCheckmate?.();
                items.push(<div key="chk" style={{
                    position: 'absolute', left: `${col * 12.5}%`, top: `${row * 12.5}%`,
                    width: '12.5%', height: '12.5%', pointerEvents: 'none', zIndex: 4,
                    boxShadow: isMate
                        ? 'inset 0 0 12px 6px rgba(220,38,38,0.9), inset 0 0 4px 2px rgba(255,50,50,1)'
                        : 'inset 0 0 10px 5px rgba(239,68,68,0.7), inset 0 0 3px 1px rgba(255,80,80,0.9)',
                    borderRadius: '1px',
                }} />);
            }
        }

        // Selected square
        if (selectedSquare) {
            const { col, row } = sqToCoords(selectedSquare, orient);
            items.push(<div key="sel" style={{
                position: 'absolute', left: `${col * 12.5}%`, top: `${row * 12.5}%`,
                width: '12.5%', height: '12.5%', backgroundColor: 'rgba(255,255,0,0.42)',
                pointerEvents: 'none', zIndex: 2,
            }} />);

            // Legal move dots
            const isPlayerTurn = game.turn() === playerColorRef.current;
            if (isPlayerTurn) {
                legalMoves.forEach((m, i) => {
                    const { col: mc, row: mr } = sqToCoords(m.to, orient);
                    const isCapture = m.captured || (m.flags && m.flags.includes('c'));
                    const targetPiece = getPieceAt(game, m.to);
                    const showAsCapture = isCapture || !!targetPiece;
                    items.push(<div key={`dot-${i}`} style={{
                        position: 'absolute', left: `${mc * 12.5}%`, top: `${mr * 12.5}%`,
                        width: '12.5%', height: '12.5%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none', zIndex: 3,
                    }}>
                        {showAsCapture
                            ? <div style={{ width: '85%', height: '85%', borderRadius: '50%', border: '5px solid rgba(0,0,0,0.22)', boxSizing: 'border-box' }} />
                            : <div style={{ width: '26%', height: '26%', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.22)' }} />
                        }
                    </div>);
                });
            }
        }

        // Premove highlight (blue)
        if (premove) {
            [premove.from, premove.to].forEach((sq, i) => {
                const { col, row } = sqToCoords(sq, orient);
                items.push(<div key={`pm-${i}`} style={{
                    position: 'absolute', left: `${col * 12.5}%`, top: `${row * 12.5}%`,
                    width: '12.5%', height: '12.5%', backgroundColor: 'rgba(0,130,255,0.3)',
                    pointerEvents: 'none', zIndex: 2,
                }} />);
            });
        }

        return items;
    }, [fen, selectedSquare, legalMoves, premove, orient]);

    return (
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 w-full max-w-7xl mx-auto items-center lg:items-center lg:justify-center lg:h-[calc(100vh-32px)]">

            {/* Controls */}
            <div className="w-full lg:w-[260px] flex flex-col gap-3 shrink-0">
                <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-4 shadow-2xl flex-1 flex flex-col justify-center">
                    {!gameStarted ? (
                        <>
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm tracking-wide">
                                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow shadow-pink-500/50"></span> Game Settings
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 block">Play As</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {Object.entries(PLAY_SIDES).map(([k, { label }]) => (
                                            <button key={k} onClick={() => setPlaySideSetting(k)}
                                                className={`px-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-200 border ${playSideSetting === k ? 'bg-blue-500/15 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/10' : 'bg-gray-800/60 text-gray-500 border-gray-700/50 hover:bg-gray-700/60 hover:text-gray-300'}`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 block">Time Control</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {Object.entries(TIME_CONTROLS).map(([k, { label }]) => (
                                            <button key={k} onClick={() => setTimeControl(k)}
                                                className={`px-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-200 border ${timeControl === k ? 'bg-pink-500/15 text-pink-400 border-pink-500/40 shadow-sm shadow-pink-500/10' : 'bg-gray-800/60 text-gray-500 border-gray-700/50 hover:bg-gray-700/60 hover:text-gray-300'}`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={startGame} disabled={!engineReady}
                                    className="w-full mt-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 text-sm bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-lg shadow-pink-600/25 disabled:opacity-40 disabled:shadow-none active:scale-[0.98]">
                                    <Play size={16} fill="currentColor" />
                                    {engineReady ? 'Start Match' : 'Loading Engine...'}
                                </button>
                                {/* Status when not playing */}
                                <div className="mt-2 flex flex-col items-center gap-1.5 text-xs font-medium bg-gray-950/70 p-3 rounded-xl border border-gray-800/40">
                                    <span className={status.includes('wins') || status.includes('over') ? 'text-yellow-400 font-bold text-center' : 'text-gray-400 text-center'}>{status}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm tracking-wide">
                                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${turn === playerColor ? 'bg-blue-500 shadow shadow-blue-500/50' : 'bg-pink-500 shadow shadow-pink-500/50'}`}></span>
                                {turn === playerColor ? 'Your Turn' : "Aria's Turn"}
                            </h3>
                            <div className="space-y-4">
                                {/* Game info */}
                                <div className="flex flex-col gap-2 text-xs">
                                    <div className="flex justify-between items-center bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/40">
                                        <span className="text-gray-500">Playing as</span>
                                        <span className="text-white font-bold">{playerColor === 'w' ? '⬜ White' : '⬛ Black'}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/40">
                                        <span className="text-gray-500">Moves</span>
                                        <span className="text-white font-bold font-mono">{Math.ceil(gameRef.current.history().length / 2)}</span>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="flex flex-col items-center gap-1.5 text-xs font-medium bg-gray-950/70 p-3 rounded-xl border border-gray-800/40">
                                    <span className="text-gray-400 text-center">{status}</span>
                                    {premove && <span className="text-blue-400/80 text-[10px] font-mono">⏩ {premove.from} → {premove.to}</span>}
                                </div>

                                {/* Resign */}
                                <button onClick={resignGame}
                                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 text-sm bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/40 active:scale-[0.98]">
                                    🏳️ Resign Match
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 w-full flex flex-col items-center justify-center shrink-0 min-w-0">
                <div className="w-full max-w-[min(85vw,500px)] sm:max-w-[min(80vw,550px)] lg:max-w-[min(70vh,600px)] flex flex-col items-center">
                    {/* Opponent */}
                    <div className={`mb-1 bg-gradient-to-r from-gray-900 to-gray-900/90 px-3 py-2 rounded-t-xl w-full flex justify-between items-center border border-gray-800/60 ${timerActive && turn !== playerColor ? 'border-b-pink-500/30' : ''}`}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-800 to-pink-950 border border-pink-500/40 flex items-center justify-center shadow-inner"><span className="text-sm">👩🏽</span></div>
                            <div>
                                <div className="font-bold text-white text-xs flex items-center gap-1.5">Aria <span className="text-[7px] uppercase font-black bg-gradient-to-r from-pink-500 to-rose-500 text-white px-1.5 py-0.5 rounded-sm">BOT</span></div>
                            </div>
                        </div>
                        <div className={`text-sm lg:text-base font-mono px-3 py-1.5 rounded-lg font-bold tabular-nums tracking-tight ${timerActive && turn !== playerColor ? 'bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/30' : 'bg-gray-800/80 text-gray-400'}`}>{formatTime(ariaTime)}</div>
                    </div>

                    {/* Board + Overlay */}
                    <div
                        ref={boardRef}
                        className={`w-full aspect-square shadow-2xl overflow-hidden border-x-[3px] transition-colors duration-300 relative select-none ${gameStarted ? (turn === playerColor ? 'border-x-blue-500/20' : 'border-x-pink-500/20') : 'border-x-gray-800/60'}`}
                        onPointerDownCapture={handlePointerDown}
                        onPointerUpCapture={handlePointerUp}
                        style={{ touchAction: 'none' }}
                    >
                        <Chessboard options={boardOptions} />
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                            {overlays}
                        </div>
                    </div>

                    {/* Player */}
                    <div className={`mt-1 bg-gradient-to-r from-gray-900 to-gray-900/90 px-3 py-2 rounded-b-xl w-full flex justify-between items-center border border-gray-800/60 ${timerActive && turn === playerColor ? 'border-t-blue-500/30' : ''}`}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-500/40 flex items-center justify-center shadow-inner"><span className="text-sm">👤</span></div>
                            <div className="font-bold text-white text-xs">You</div>
                        </div>
                        <div className={`text-sm lg:text-base font-mono px-3 py-1.5 rounded-lg font-bold tabular-nums tracking-tight ${timerActive && turn === playerColor ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30' : 'bg-gray-800/80 text-gray-400'}`}>{formatTime(playerTime)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChessGame;
