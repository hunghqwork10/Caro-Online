import React from "react";
import { SquareValue } from "../types";
import './Square.css';

interface SquareProps {
    value: SquareValue;
    onClick: () => void;
}

export default function Square({ value, onClick }: SquareProps) {
    return (
        <button
            className={`square${value ? ` square-${value.toLowerCase()}` : ''}`}
            onClick={onClick}
        >
            {value}
        </button>
    );
}