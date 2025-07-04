import React, { useCallback, useEffect, useState, useRef } from "react";
import "./MultiRangeSlider.css";

interface MultiRangeSliderProps {
    min: number;
    max: number;
    onChange: (values: { min: number; max: number }) => void;
    value?: { min: number; max: number };
}

export const MultiRangeSlider: React.FC<MultiRangeSliderProps> = ({
    min,
    max,
    onChange,
    value = { min: 0, max: 1 }
}) => {
    const [minVal, setMinVal] = useState(value.min);
    const [maxVal, setMaxVal] = useState(value.max);
    const minValRef = useRef(value.min);
    const maxValRef = useRef(value.max);
    const range = useRef<HTMLDivElement>(null);
    const isUpdatingRef = useRef(false);

    // Update internal state when value prop changes
    useEffect(() => {
        if (!isUpdatingRef.current) {
            setMinVal(value.min);
            setMaxVal(value.max);
            minValRef.current = value.min;
            maxValRef.current = value.max;
        }
    }, [value.min, value.max]);

    // Convert to percentage
    const getPercent = useCallback(
        (value: number) => Math.round(((value - min) / (max - min)) * 100),
        [min, max]
    );

    // Set width of the range to decrease from the left side
    useEffect(() => {
        const minPercent = getPercent(minVal);
        const maxPercent = getPercent(maxValRef.current);

        if (range.current) {
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, getPercent]);

    // Set width of the range to decrease from the right side
    useEffect(() => {
        const minPercent = getPercent(minValRef.current);
        const maxPercent = getPercent(maxVal);

        if (range.current) {
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [maxVal, getPercent]);

    // Get min and max values when their state changes
    useEffect(() => {
        if (isUpdatingRef.current) {
            isUpdatingRef.current = false;
            onChange({ min: minVal, max: maxVal });
        }
    }, [minVal, maxVal, onChange]);

    const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.min(Number(event.target.value), maxVal - 1);
        isUpdatingRef.current = true;
        setMinVal(value);
        minValRef.current = value;
    };

    const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(Number(event.target.value), minVal + 1);
        isUpdatingRef.current = true;
        setMaxVal(value);
        maxValRef.current = value;
    };

    return (
        <div className="slider-container">
            <input
                type="range"
                min={min}
                max={max}
                value={minVal}
                onChange={handleMinChange}
                className="thumb thumb--left"
                style={{ zIndex: minVal > max - 100 ? "5" : undefined }}
            />
            <input
                type="range"
                min={min}
                max={max}
                value={maxVal}
                onChange={handleMaxChange}
                className="thumb thumb--right"
            />

            <div className="slider">
                <div className="slider__track" />
                <div ref={range} className="slider__range" />
                <div className="slider__left-value">{minVal}</div>
                <div className="slider__right-value">{maxVal}</div>
            </div>
        </div>
    );
};

export default MultiRangeSlider; 