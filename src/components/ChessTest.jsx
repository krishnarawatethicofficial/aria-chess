import React, { useState, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export default function ChessTest() {
    const gameRef = useRef(new Chess());
    const [fen, setFen] = useState(gameRef.current.fen());
    const [log, setLog] = useState([]);

    const addLog = (msg) => {
        console.log(msg);
        setLog(prev => [...prev, msg]);
    };

    // react-chessboard v5: onPieceDrop receives { piece, sourceSquare, targetSquare }
    const onDrop = ({ piece, sourceSquare, targetSquare }) => {
        addLog(`Drop: ${sourceSquare} -> ${targetSquare} (${piece}), turn: ${gameRef.current.turn()}`);
        try {
            const moveObj = { from: sourceSquare, to: targetSquare };
            const result = gameRef.current.move(moveObj);
            addLog(`Move result: ${JSON.stringify(result)}`);
            const newFen = gameRef.current.fen();
            addLog(`New FEN: ${newFen}`);
            setFen(newFen);
            return true;
        } catch (e) {
            addLog(`Move error: ${e.message}`);
            return false;
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h2 style={{ color: 'white' }}>Chess Test - Minimal (v5 API)</h2>
            <p style={{ color: 'lime' }}>FEN: {fen}</p>
            <p style={{ color: 'yellow' }}>Turn: {gameRef.current.turn()}</p>
            <div style={{ width: 400 }}>
                <Chessboard
                    options={{
                        position: fen,
                        onPieceDrop: onDrop,
                        boardOrientation: 'white',
                        allowDragging: true,
                    }}
                />
            </div>
            <div style={{ color: 'white', marginTop: 10, maxHeight: 200, overflow: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
                {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
    );
}
