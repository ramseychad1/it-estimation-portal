import { Search } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  width?: number | string;
}

/**
 * Ghost-style search input — warm-gray-light fill, no border, magnifying
 * glass icon. Width defaults to 320px (matches the toolbar in the design).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { width = 320, placeholder = "Search…", className = "", ...rest },
  ref,
) {
  return (
    <label
      className={`inline-flex items-center gap-2 px-3 rounded-md cursor-text ${className}`}
      style={{
        width,
        height: 32,
        background: "var(--color-warm-gray-light)",
        border: "1px solid transparent",
        color: "var(--fg-2)",
      }}
    >
      <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className="flex-1 border-0 outline-none bg-transparent text-near-black"
        style={{ fontSize: 13 }}
        {...rest}
      />
    </label>
  );
});
