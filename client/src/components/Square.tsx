import React from "react";
import { SquareValue } from "../types";

interface SquareProps {
    value: SquareValue;
    onClick: () => void;
}

export default function Square({ value, onClick }: SquareProps) {
    return (
        <button
            className="square"
            onClick={onClick}
            style={{
                width: '40px',
                height: '40px',
                background: '#fff',
                border: '1px solid #999',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {value}
        </button>
    );
}