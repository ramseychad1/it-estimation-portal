import { GripVertical } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

/**
 * Drag handle. Visual only — actual drag wiring happens in the consuming
 * component via @dnd-kit's useSortable() listeners. Pass those listeners
 * directly to the rendered button via spread props.
 */
export const DragHandle = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function DragHandle({ className = "", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Drag to reorder"
        className={`inline-flex items-center justify-center text-warm-gray-med hover:bg-warm-gray-light hover:text-near-black active:cursor-grabbing border-0 bg-transparent rounded ${className}`}
        style={{ width: 20, height: 20, cursor: "grab" }}
        {...rest}
      >
        <GripVertical className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    );
  },
);
